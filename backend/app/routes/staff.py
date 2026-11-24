from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from app.db import local_db
from app.services.notification_service import send_notification
from app.services.cloudinary_service import generate_and_upload_diagnostic_report, upload_file, is_cloudinary_available

staff_bp = Blueprint("staff", __name__)

def mask_patient_for_staff(patient: dict) -> dict:
    """Mask patient identity for laboratory staff privacy."""
    if not patient:
        return None
    full_name = patient.get("full_name", "")
    masked_name = " ".join("X" * len(word) for word in full_name.split()) if full_name else "XXXXX XXXXX"
    pid = patient.get("id", "")
    code = f"PATIENT-{pid[:6].upper()}" if pid else "PATIENT-001"
    return {
        "id": pid,
        "patient_code": code,
        "full_name": masked_name,
        "age": patient.get("age"),
        "gender": patient.get("gender"),
        "phone": "• • • • • • • • • •",
        "email": "• • • • • • • • • •"
    }


@staff_bp.route("/dashboard", methods=["GET"])
def get_dashboard_stats():
    tests = local_db.get("tests")
    waiting_count = sum(1 for t in tests if t.get("status") == "WAITING_IN_QUEUE")
    high_priority_count = sum(1 for t in tests if t.get("status") == "WAITING_IN_QUEUE" and t.get("priority") == "HIGH")
    in_progress_count = sum(1 for t in tests if t.get("status") in ["IN_PROGRESS", "ASSIGNED"])

    today_str = datetime.now(timezone.utc).isoformat()[:10]
    completed_today_count = sum(
        1 for t in tests
        if t.get("status") == "COMPLETED"
        and t.get("completed_at")
        and t.get("completed_at", "").startswith(today_str)
    )

    return jsonify({
        "success": True,
        "stats": {
            "waiting_tests": waiting_count,
            "high_priority": high_priority_count,
            "in_progress": in_progress_count,
            "completed_today": completed_today_count
        }
    })


@staff_bp.route("/current-test", methods=["GET"])
def get_current_test():
    staff_id = request.args.get("staff_id") or "b0000000-0000-0000-0000-000000000001"
    tests = local_db.get("tests")
    patients = {p["id"]: p for p in local_db.get("patients")}
    staff_members = {s["id"]: s for s in local_db.get("profiles")}

    active_test = None
    for t in tests:
        if (t.get("assigned_to") == staff_id or not t.get("assigned_to")) and t.get("status") in ["ASSIGNED", "IN_PROGRESS"]:
            active_test = t
            break

    if not active_test:
        return jsonify({"success": True, "test": None})

    patient = patients.get(active_test.get("patient_id"))
    assigned_staff = staff_members.get(active_test.get("assigned_to"))

    enriched_test = dict(active_test)
    enriched_test["patient"] = mask_patient_for_staff(patient)
    enriched_test["assigned_staff_name"] = assigned_staff.get("full_name") if assigned_staff else "Assigned Staff"

    return jsonify({
        "success": True,
        "test": enriched_test
    })


@staff_bp.route("/start-test", methods=["POST"])
def start_test():
    data = request.get_json(silent=True) or {}
    test_id = data.get("test_id")
    staff_id = data.get("staff_id")

    if not test_id:
        return jsonify({"success": False, "error": "test_id is required"}), 400

    now_iso = datetime.now(timezone.utc).isoformat()
    updated = local_db.update("tests", test_id, {
        "status": "IN_PROGRESS",
        "started_at": now_iso
    })

    local_db.insert("activity_logs", {
        "user_id": staff_id,
        "action": "STARTED_TEST",
        "entity_type": "test",
        "entity_id": test_id
    })

    return jsonify({
        "success": True,
        "message": "Test processing started.",
        "test": updated
    })


@staff_bp.route("/complete-test", methods=["POST"])
def complete_test():
    try:
        data = request.get_json(silent=True) or {}
        test_id = data.get("test_id")
        staff_id = data.get("staff_id")
        remarks = data.get("remarks")

        if not test_id:
            return jsonify({"success": False, "error": "test_id is required"}), 400

        test = next((t for t in local_db.get("tests") if t.get("id") == test_id), None)
        if not test:
            return jsonify({"success": False, "error": "Test not found"}), 404

        now_iso = datetime.now(timezone.utc).isoformat()
        tracking_num = test.get("tracking_number", "unknown")
        patient = next((p for p in local_db.get("patients") if p.get("id") == test.get("patient_id")), None)

        # Generate / upload report to Cloudinary or use provided report URL
        report_url = data.get("report_url") or data.get("report_path")
        if not report_url:
            report_url = generate_and_upload_diagnostic_report(test, patient)

        completed_test = local_db.update("tests", test_id, {
            "status": "COMPLETED",
            "completed_at": now_iso,
            "report_path": report_url,
            "remarks": remarks or "Analysis completed with verified clinical diagnostics."
        })

        local_db.insert("activity_logs", {
            "user_id": staff_id,
            "action": "COMPLETED_TEST",
            "entity_type": "test",
            "entity_id": test_id,
            "details": {
                "tracking_number": tracking_num,
                "completion_time": now_iso,
                "report_url": report_url
            }
        })

        # Trigger patient SMS and Email notification
        if patient:
            send_notification(
                test_id=test["id"],
                patient_id=patient["id"],
                notification_type="COMPLETED",
                recipient_phone=patient.get("phone"),
                recipient_email=patient.get("email"),
                tracking_number=tracking_num,
                priority=test.get("priority")
            )

        return jsonify({
            "success": True,
            "message": "Test completed successfully. Report generated and patient notifications triggered.",
            "test": completed_test
        })

    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 500


@staff_bp.route("/completed-tests", methods=["GET"])
def get_completed_tests():
    tests = [t for t in local_db.get("tests") if t.get("status") == "COMPLETED"]
    patients = {p["id"]: p for p in local_db.get("patients")}

    enriched = []
    for t in tests:
        item = dict(t)
        item["patient"] = mask_patient_for_staff(patients.get(t.get("patient_id")))
        enriched.append(item)

    return jsonify({
        "success": True,
        "count": len(enriched),
        "tests": enriched
    })


@staff_bp.route("/upload-report", methods=["POST"])
def upload_report():
    """Uploads a diagnostic report file to Cloudinary."""
    try:
        # Check if multipart form upload
        if "file" in request.files:
            uploaded_file = request.files["file"]
            filename = uploaded_file.filename or "DiagnosticReport.pdf"
            result = upload_file(uploaded_file, filename=filename)
            if result.get("success"):
                return jsonify({
                    "success": True,
                    "url": result.get("secure_url"),
                    "filename": filename,
                    "message": "Report uploaded to Cloudinary successfully."
                })
            return jsonify({"success": False, "error": result.get("error")}), 400

        # Check JSON payload
        data = request.get_json(silent=True) or {}
        file_url = data.get("file_url")
        filename = data.get("filename") or "DiagnosticReport.pdf"
        if file_url:
            return jsonify({
                "success": True,
                "url": file_url,
                "filename": filename
            })

        return jsonify({"success": False, "error": "No file or report URL provided."}), 400
    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 500

