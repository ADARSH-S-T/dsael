"""
Biometric API Routes for LabFlow
Endpoints:
  POST /api/biometric/register          - Register patient face embedding
  POST /api/biometric/identify          - Identify patient by live face scan (1-to-many)
  GET  /api/biometric/status/<patient_id> - Public: has this patient enrolled? (bool only)
  POST /api/biometric/admin/reset/<patient_id> - Admin: reset/disable biometric
  GET  /api/biometric/admin/logs        - Admin: view verification logs
  GET  /api/biometric/admin/patients    - Admin: list patients with biometric status
"""

import time
from collections import defaultdict
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from app.db import local_db
from app.services.biometric_service import (
    is_biometric_available,
    register_face,
    identify_by_face,
    reset_biometric,
    get_biometric_status
)

biometric_bp = Blueprint("biometric", __name__)

# ------------------------------------------------------------------
# Simple in-process rate limiter: max N attempts per IP per hour
# ------------------------------------------------------------------
_rate_limit_store: dict = defaultdict(list)
MAX_ATTEMPTS = 10
WINDOW_SECS = 3600


def _is_rate_limited(ip: str) -> bool:
    now = time.time()
    _rate_limit_store[ip] = [t for t in _rate_limit_store[ip] if now - t < WINDOW_SECS]
    if len(_rate_limit_store[ip]) >= MAX_ATTEMPTS:
        return True
    _rate_limit_store[ip].append(now)
    return False


# ------------------------------------------------------------------
# Health / capability check
# ------------------------------------------------------------------
@biometric_bp.route("/status", methods=["GET"])
def biometric_status():
    return jsonify({
        "success": True,
        "face_recognition_available": is_biometric_available(),
        "message": "Face recognition active." if is_biometric_available()
                   else "Face recognition engine not configured. Use Tracking ID + Password to access reports."
    })


# ------------------------------------------------------------------
# Register face (called right after patient registration)
# ------------------------------------------------------------------
@biometric_bp.route("/register", methods=["POST"])
def register_biometric():
    ip = request.remote_addr or "unknown"
    if _is_rate_limited(ip):
        return jsonify({"success": False, "error": "Too many requests. Please try again later."}), 429

    data = request.get_json(silent=True) or {}
    patient_id = data.get("patient_id", "").strip()
    image_b64 = data.get("image_b64", "").strip()
    consent = bool(data.get("consent", False))

    if not patient_id:
        return jsonify({"success": False, "error": "patient_id is required."}), 400
    if not image_b64:
        return jsonify({"success": False, "error": "image_b64 is required."}), 400

    # Verify patient exists
    patient = next((p for p in local_db.get("patients") if p.get("id") == patient_id), None)
    if not patient:
        return jsonify({"success": False, "error": "Patient not found."}), 404

    result = register_face(patient_id, image_b64, consent)

    if result.get("success"):
        return jsonify(result), 200
    return jsonify(result), 400


# ------------------------------------------------------------------
# Identify patient by face (1-to-many, used in Track My Test)
# ------------------------------------------------------------------
@biometric_bp.route("/identify", methods=["POST"])
def identify_patient():
    ip = request.remote_addr or "unknown"
    if _is_rate_limited(ip):
        # Also log the failed attempt
        local_db.insert("biometric_verification_logs", {
            "patient_id": None,
            "verification_status": "RATE_LIMITED",
            "confidence_score": 0,
            "liveness_status": "UNKNOWN",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return jsonify({"success": False, "error": "Too many requests. Please wait before trying again."}), 429

    data = request.get_json(silent=True) or {}
    image_b64 = data.get("image_b64", "").strip()

    if not image_b64:
        return jsonify({"success": False, "error": "image_b64 is required."}), 400

    result = identify_by_face(image_b64)

    if result.get("success"):
        # Fetch all tests for this patient
        patient_id = result["patient_id"]
        tests = [t for t in local_db.get("tests") if t.get("patient_id") == patient_id]
        patient = next((p for p in local_db.get("patients") if p.get("id") == patient_id), None)

        # Strip PII from patient returned to frontend
        safe_patient = None
        if patient:
            ph = patient.get("phone", "")
            em = patient.get("email", "")
            masked_phone = ph[:2] + "*" * max(0, len(ph) - 4) + ph[-2:] if len(ph) >= 4 else ph
            at_idx = em.find("@")
            masked_email = (em[:2] + "***" + em[at_idx:]) if at_idx > 2 else em
            safe_patient = {
                "id": patient["id"],
                "full_name": patient.get("full_name"),
                "masked_phone": masked_phone,
                "masked_email": masked_email
            }

        # Strip PII from tests
        safe_tests = []
        for t in tests:
            safe_tests.append({
                "id": t.get("id"),
                "tracking_number": t.get("tracking_number"),
                "test_name": t.get("test_name"),
                "test_category": t.get("test_category"),
                "sample_type": t.get("sample_type"),
                "priority": t.get("priority"),
                "status": t.get("status"),
                "registered_at": t.get("registered_at"),
                "started_at": t.get("started_at"),
                "completed_at": t.get("completed_at"),
                "remarks": t.get("remarks"),
                "report_available": t.get("status") == "COMPLETED",
                "report_path": t.get("report_path") if t.get("status") == "COMPLETED" else None
            })

        return jsonify({
            "success": True,
            "identified": True,
            "confidence": result["confidence"],
            "liveness_score": result.get("liveness_score"),
            "patient": safe_patient,
            "tests": safe_tests
        })

    return jsonify(result), 401


# ------------------------------------------------------------------
# Check if a patient has biometric enrolled (safe – returns bool only)
# ------------------------------------------------------------------
@biometric_bp.route("/enrolled/<patient_id>", methods=["GET"])
def check_enrolled(patient_id):
    status = get_biometric_status(patient_id)
    return jsonify({
        "success": True,
        "enrolled": status.get("registered", False)
    })


# ------------------------------------------------------------------
# ADMIN: reset/disable a patient's biometric
# ------------------------------------------------------------------
@biometric_bp.route("/admin/reset/<patient_id>", methods=["POST"])
def admin_reset_biometric(patient_id):
    data = request.get_json(silent=True) or {}
    admin_id = data.get("admin_id", "").strip()
    if not admin_id:
        return jsonify({"success": False, "error": "admin_id is required."}), 400

    result = reset_biometric(patient_id, admin_id)
    if result.get("success"):
        return jsonify(result)
    return jsonify(result), 404


# ------------------------------------------------------------------
# ADMIN: view verification logs (no raw templates)
# ------------------------------------------------------------------
@biometric_bp.route("/admin/logs", methods=["GET"])
def admin_verification_logs():
    logs = local_db.get("biometric_verification_logs")
    logs_sorted = sorted(logs, key=lambda x: x.get("created_at", ""), reverse=True)
    # Never expose encrypted_face_template
    safe_logs = []
    for log in logs_sorted:
        safe_logs.append({
            "id": log.get("id"),
            "patient_id": log.get("patient_id"),
            "verification_status": log.get("verification_status"),
            "confidence_score": log.get("confidence_score"),
            "liveness_status": log.get("liveness_status"),
            "created_at": log.get("created_at")
        })
    return jsonify({"success": True, "count": len(safe_logs), "logs": safe_logs})


# ------------------------------------------------------------------
# ADMIN: list all patients with biometric status (no templates)
# ------------------------------------------------------------------
@biometric_bp.route("/admin/patients", methods=["GET"])
def admin_biometric_patients():
    patients = local_db.get("patients")
    biometrics = {b["patient_id"]: b for b in local_db.get("patient_biometrics")}
    result = []
    for p in patients:
        bio = biometrics.get(p["id"], {})
        result.append({
            "patient_id": p["id"],
            "full_name": p.get("full_name"),
            "biometric_status": bio.get("registration_status", "NOT_REGISTERED"),
            "registered": bio.get("registration_status") == "REGISTERED",
            "consent_timestamp": bio.get("consent_timestamp"),
            "registered_at": bio.get("created_at"),
            "updated_at": bio.get("updated_at")
        })
    return jsonify({"success": True, "patients": result})
