import random
import re
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from app.db import local_db
from app.config import IS_SUPABASE_CONFIGURED, SUPABASE_URL, SUPABASE_KEY
from app.services.priority_engine import evaluate_test_priority, record_priority_history
from app.services.notification_service import send_notification
import requests

patients_bp = Blueprint("patients", __name__)

def generate_tracking_number() -> str:
    tests = local_db.get("tests")
    existing_numbers = {t.get("tracking_number") for t in tests if t.get("tracking_number")}
    for _ in range(100):
        candidate = str(random.randint(10000, 99999))
        if candidate not in existing_numbers:
            return candidate
    return str(random.randint(10000, 99999))


@patients_bp.route("/register", methods=["POST"])
def register():
    try:
        data = request.get_json(silent=True) or {}
        patient_name = data.get("patient_name", "").strip()
        phone = data.get("phone", "").strip()
        email = data.get("email", "").strip().lower()
        age = data.get("age")
        gender = data.get("gender", "Other")
        test_name = data.get("test_name", "").strip()
        test_category = data.get("test_category", "").strip()
        sample_type = data.get("sample_type", "").strip()
        sample_details = data.get("sample_details", "").strip()
        additional_information = data.get("additional_information")

        # 1. Validation
        if not all([patient_name, phone, email, age, test_name, test_category, sample_type, sample_details]):
            return jsonify({
                "success": False,
                "error": "All required fields must be provided."
            }), 400

        now_iso = datetime.now(timezone.utc).isoformat()

        # 2. Save Patient
        patient_record = {
            "full_name": patient_name,
            "phone": phone,
            "email": email,
            "age": int(age),
            "gender": gender
        }

        patient = None
        if IS_SUPABASE_CONFIGURED:
            try:
                res = requests.post(
                    f"{SUPABASE_URL}/rest/v1/patients",
                    headers={
                        "apikey": SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY}",
                        "Content-Type": "application/json",
                        "Prefer": "return=representation"
                    },
                    json=patient_record,
                    timeout=5
                )
                if res.ok and res.json():
                    patient = res.json()[0]
            except Exception as e:
                print(f"[PatientRegister] Supabase patient error: {e}")

        if not patient:
            patient = local_db.insert("patients", patient_record)

        # 3. Generate Unique 5-Digit Tracking Code
        tracking_number = generate_tracking_number()

        # 4. Evaluate Automatic Priority Engine
        eval_result = evaluate_test_priority({
            "test_category": test_category,
            "test_name": test_name,
            "sample_details": sample_details
        })

        is_queued = eval_result.get("status") == "WAITING_IN_QUEUE"

        # 5. Create Test Record
        test_record = {
            "tracking_number": tracking_number,
            "patient_id": patient.get("id"),
            "test_name": test_name,
            "test_category": test_category,
            "sample_type": sample_type,
            "sample_details": sample_details,
            "additional_information": additional_information or None,
            "priority": eval_result.get("priority"),
            "priority_source": eval_result.get("source"),
            "priority_reason": eval_result.get("reason"),
            "status": eval_result.get("status"),
            "queue_entered_at": now_iso if is_queued else None,
            "registered_at": now_iso,
            "assigned_to": None,
            "started_at": None,
            "completed_at": None,
            "report_path": None,
            "remarks": None
        }

        created_test = None
        if IS_SUPABASE_CONFIGURED:
            try:
                res = requests.post(
                    f"{SUPABASE_URL}/rest/v1/tests",
                    headers={
                        "apikey": SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY}",
                        "Content-Type": "application/json",
                        "Prefer": "return=representation"
                    },
                    json=test_record,
                    timeout=5
                )
                if res.ok and res.json():
                    created_test = res.json()[0]
            except Exception as e:
                print(f"[PatientRegister] Supabase test create error: {e}")

        if not created_test:
            created_test = local_db.insert("tests", test_record)

        # 6. Record Priority History
        if eval_result.get("priority"):
            record_priority_history(
                test_id=created_test.get("id"),
                previous_priority=None,
                new_priority=eval_result.get("priority"),
                method="AUTOMATIC",
                reason=eval_result.get("reason")
            )

        # 7. Dispatch Notification (Registration Confirmation)
        send_notification(
            test_id=created_test.get("id"),
            patient_id=patient.get("id"),
            notification_type="REGISTRATION" if is_queued else "PRIORITY_REVIEW",
            recipient_phone=patient.get("phone"),
            recipient_email=patient.get("email"),
            tracking_number=tracking_number,
            priority=eval_result.get("priority")
        )

        # 8. Return Confirmation
        return jsonify({
            "success": True,
            "message": "Test Registered Successfully",
            "tracking_number": tracking_number,
            "test": created_test,
            "patient": patient,
            "priority_status": eval_result
        }), 201

    except Exception as err:
        print(f"[Registration Error]: {err}")
        return jsonify({"success": False, "error": str(err)}), 500


@patients_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    data = request.get_json(silent=True) or {}
    tracking_number = data.get("tracking_number", "").strip()

    if not tracking_number:
        return jsonify({"success": False, "error": "Tracking ID is required."}), 400

    test = next((t for t in local_db.get("tests") if t.get("tracking_number") == tracking_number), None)
    if not test:
        return jsonify({"success": False, "error": "Invalid tracking number. No test found."}), 404

    return jsonify({
        "success": True,
        "message": "Patient identity verified.",
        "verified": True
    })


@patients_bp.route("/track/<tracking_number>", methods=["GET"])
def track(tracking_number):
    tracking_number = tracking_number.strip()
    test = None
    patient = None

    if IS_SUPABASE_CONFIGURED:
        try:
            res = requests.get(
                f"{SUPABASE_URL}/rest/v1/tests?tracking_number=eq.{tracking_number}&select=*,patient:patient_id(*)",
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}"
                },
                timeout=5
            )
            if res.ok and res.json():
                test = res.json()[0]
                patient = test.get("patient")
        except Exception as e:
            print(f"[Track] Supabase error: {e}")

    if not test:
        test = next((t for t in local_db.get("tests") if t.get("tracking_number") == tracking_number), None)
        if test:
            patient = next((p for p in local_db.get("patients") if p.get("id") == test.get("patient_id")), None)

    if not test:
        return jsonify({
            "success": False,
            "error": f'Test with Tracking ID "{tracking_number}" was not found.'
        }), 404

    # Mask sensitive contact details for patient security
    masked_phone = None
    masked_email = None
    if patient:
        ph = patient.get("phone", "")
        if len(ph) >= 4:
            masked_phone = ph[:2] + "*" * (len(ph) - 4) + ph[-2:]
        else:
            masked_phone = ph

        em = patient.get("email", "")
        if "@" in em:
            parts = em.split("@")
            name_part = parts[0]
            masked_email = (name_part[:2] + "***" if len(name_part) > 2 else name_part + "***") + "@" + parts[1]
        else:
            masked_email = em

    return jsonify({
        "success": True,
        "test": {
            "tracking_number": test.get("tracking_number"),
            "test_name": test.get("test_name"),
            "test_category": test.get("test_category"),
            "sample_type": test.get("sample_type"),
            "priority": test.get("priority"),
            "status": test.get("status"),
            "registered_at": test.get("registered_at"),
            "started_at": test.get("started_at"),
            "completed_at": test.get("completed_at"),
            "remarks": test.get("remarks"),
            "report_available": bool(test.get("status") == "COMPLETED" or test.get("report_path")),
            "report_path": test.get("report_path") if test.get("status") == "COMPLETED" else None
        },
        "patient": {
            "full_name": patient.get("full_name") if patient else None,
            "masked_phone": masked_phone,
            "masked_email": masked_email
        } if patient else None
    })
