from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from app.db import local_db
from app.services.priority_engine import record_priority_history

admin_bp = Blueprint("admin", __name__)

@admin_bp.route("/stats", methods=["GET"])
def get_stats():
    tests = local_db.get("tests")
    total = len(tests)
    waiting = sum(1 for t in tests if t.get("status") == "WAITING_IN_QUEUE")
    completed = sum(1 for t in tests if t.get("status") == "COMPLETED")
    awaiting_review = sum(1 for t in tests if t.get("status") == "AWAITING_ADMIN_REVIEW")
    in_progress = sum(1 for t in tests if t.get("status") in ["IN_PROGRESS", "ASSIGNED"])

    return jsonify({
        "success": True,
        "stats": {
            "total_tests": total,
            "waiting_tests": waiting,
            "completed_tests": completed,
            "awaiting_review": awaiting_review,
            "in_progress": in_progress
        }
    })


@admin_bp.route("/tests", methods=["GET"])
def get_all_tests():
    priority = request.args.get("priority")
    status = request.args.get("status")
    category = request.args.get("category")
    search = request.args.get("search")

    tests = local_db.get("tests")
    patients = {p["id"]: p for p in local_db.get("patients")}
    staff_members = {s["id"]: s for s in local_db.get("profiles")}

    if priority and priority != "ALL":
        tests = [t for t in tests if t.get("priority") == priority]

    if status and status != "ALL":
        tests = [t for t in tests if t.get("status") == status]

    if category and category != "ALL":
        tests = [t for t in tests if t.get("test_category") == category]

    if search:
        q = search.lower().strip()
        tests = [
            t for t in tests
            if q in (t.get("tracking_number") or "").lower()
            or q in (t.get("test_name") or "").lower()
        ]

    enriched = []
    for t in tests:
        item = dict(t)
        item["patient"] = patients.get(t.get("patient_id"))
        staff = staff_members.get(t.get("assigned_to"))
        item["assigned_staff_name"] = staff.get("full_name") if staff else None
        enriched.append(item)

    # Sort newest first by registered_at
    enriched.sort(key=lambda x: x.get("registered_at") or "", reverse=True)

    return jsonify({
        "success": True,
        "count": len(enriched),
        "tests": enriched
    })


@admin_bp.route("/priority-review", methods=["GET"])
def get_priority_reviews():
    tests = [t for t in local_db.get("tests") if t.get("status") == "AWAITING_ADMIN_REVIEW"]
    patients = {p["id"]: p for p in local_db.get("patients")}

    enriched = []
    for t in tests:
        item = dict(t)
        item["patient"] = patients.get(t.get("patient_id"))
        enriched.append(item)

    return jsonify({
        "success": True,
        "count": len(enriched),
        "tests": enriched
    })


@admin_bp.route("/priority-review/<string:id>", methods=["POST"])
def submit_priority_review(id):
    data = request.get_json(silent=True) or {}
    priority = data.get("priority")
    reason = (data.get("reason") or "").strip()
    admin_id = data.get("admin_id")

    if not priority or priority not in ["HIGH", "MEDIUM", "LOW"]:
        return jsonify({"success": False, "error": "Priority must be HIGH, MEDIUM, or LOW."}), 400

    if not reason:
        return jsonify({"success": False, "error": "A justification reason is required for manual assignment."}), 400

    test = next((t for t in local_db.get("tests") if t.get("id") == id), None)
    if not test:
        return jsonify({"success": False, "error": "Test not found"}), 404

    now_iso = datetime.now(timezone.utc).isoformat()

    # Move test into WAITING_IN_QUEUE
    updated = local_db.update("tests", id, {
        "priority": priority,
        "priority_source": "MANUAL",
        "priority_reason": f"Admin Assigned: {reason}",
        "status": "WAITING_IN_QUEUE",
        "queue_entered_at": now_iso
    })

    # Record priority audit history
    record_priority_history(
        test_id=id,
        previous_priority=test.get("priority"),
        new_priority=priority,
        method="MANUAL",
        reason=reason,
        changed_by=admin_id
    )

    # Log activity
    local_db.insert("activity_logs", {
        "user_id": admin_id,
        "action": "ADMIN_ASSIGNED_PRIORITY",
        "entity_type": "test",
        "entity_id": id,
        "details": {
            "tracking_number": test.get("tracking_number"),
            "priority": priority,
            "reason": reason
        }
    })

    return jsonify({
        "success": True,
        "message": f"Test {test.get('tracking_number')} assigned priority {priority} and moved into waiting queue.",
        "test": updated
    })


@admin_bp.route("/priority-override/<string:id>", methods=["POST"])
def override_priority(id):
    data = request.get_json(silent=True) or {}
    priority = data.get("priority")
    reason = (data.get("reason") or "").strip()
    admin_id = data.get("admin_id")

    if not priority or priority not in ["HIGH", "MEDIUM", "LOW"]:
        return jsonify({"success": False, "error": "Invalid priority level"}), 400

    if not reason:
        return jsonify({"success": False, "error": "Reason is required for priority override"}), 400

    test = next((t for t in local_db.get("tests") if t.get("id") == id), None)
    if not test:
        return jsonify({"success": False, "error": "Test not found"}), 404

    prev_priority = test.get("priority")
    updated = local_db.update("tests", id, {
        "priority": priority,
        "priority_source": "MANUAL",
        "priority_reason": f"Admin Override: {reason}"
    })

    record_priority_history(
        test_id=id,
        previous_priority=prev_priority,
        new_priority=priority,
        method="MANUAL",
        reason=reason,
        changed_by=admin_id
    )

    return jsonify({
        "success": True,
        "message": "Priority overridden successfully",
        "test": updated
    })


@admin_bp.route("/rules", methods=["GET"])
def get_rules():
    rules = local_db.get("priority_rules")
    return jsonify({"success": True, "count": len(rules), "rules": rules})


@admin_bp.route("/rules", methods=["POST"])
def create_rule():
    data = request.get_json(silent=True) or {}
    rule_name = (data.get("rule_name") or "").strip()
    test_category = (data.get("test_category") or "").strip()
    configured_priority = data.get("configured_priority")
    processing_deadline = data.get("processing_deadline", 60)
    keywords = data.get("keywords") or []

    if not rule_name or not test_category or not configured_priority:
        return jsonify({"success": False, "error": "Missing required rule parameters"}), 400

    if isinstance(keywords, str):
        keywords = [k.strip() for k in keywords.split(",") if k.strip()]

    new_rule = local_db.insert("priority_rules", {
        "rule_name": rule_name,
        "test_category": test_category,
        "configured_priority": configured_priority,
        "processing_deadline": int(processing_deadline or 60),
        "rule_conditions": {"keywords": keywords},
        "is_active": True
    })

    return jsonify({
        "success": True,
        "message": "Rule created successfully",
        "rule": new_rule
    }), 201


@admin_bp.route("/rules/<string:id>", methods=["PUT"])
def update_rule(id):
    data = request.get_json(silent=True) or {}
    updated = local_db.update("priority_rules", id, data)
    return jsonify({"success": True, "message": "Rule updated", "rule": updated})


@admin_bp.route("/rules/<string:id>", methods=["DELETE"])
def delete_rule(id):
    local_db.delete("priority_rules", id)
    return jsonify({"success": True, "message": "Rule deleted"})


@admin_bp.route("/staff", methods=["GET"])
def get_staff_list():
    staff = [p for p in local_db.get("profiles") if p.get("role") == "staff"]
    tests = local_db.get("tests")

    enriched_staff = []
    for s in staff:
        s_id = s.get("id")
        assigned_tests = sum(
            1 for t in tests
            if t.get("assigned_to") == s_id and t.get("status") in ["ASSIGNED", "IN_PROGRESS"]
        )
        completed_tests = sum(
            1 for t in tests
            if t.get("assigned_to") == s_id and t.get("status") == "COMPLETED"
        )
        item = dict(s)
        item["active_workload"] = assigned_tests
        item["total_completed"] = completed_tests
        enriched_staff.append(item)

    return jsonify({"success": True, "staff": enriched_staff})


@admin_bp.route("/staff", methods=["POST"])
def add_staff():
    data = request.get_json(silent=True) or {}
    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    phone = (data.get("phone") or "+91 98765 00000").strip()

    if not full_name or not email:
        return jsonify({"success": False, "error": "Full name and email required"}), 400

    new_staff = local_db.insert("profiles", {
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "role": "staff",
        "is_active": True
    })

    return jsonify({
        "success": True,
        "message": "Staff member added successfully",
        "staff": new_staff
    }), 201


@admin_bp.route("/staff/<string:id>/toggle", methods=["PATCH"])
def toggle_staff_status(id):
    member = next((p for p in local_db.get("profiles") if p.get("id") == id), None)
    if not member:
        return jsonify({"success": False, "error": "Staff member not found"}), 404

    updated = local_db.update("profiles", id, {"is_active": not member.get("is_active", True)})
    state_str = "activated" if updated.get("is_active") else "deactivated"
    return jsonify({
        "success": True,
        "message": f"Staff member {state_str}",
        "staff": updated
    })


@admin_bp.route("/notifications", methods=["GET"])
def get_notifications():
    notifications = local_db.get("notifications")
    notifications.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return jsonify({
        "success": True,
        "count": len(notifications),
        "notifications": notifications
    })


@admin_bp.route("/activity-logs", methods=["GET"])
def get_activity_logs():
    logs = local_db.get("activity_logs")
    logs.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return jsonify({
        "success": True,
        "count": len(logs),
        "logs": logs
    })
