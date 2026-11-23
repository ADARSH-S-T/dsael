from flask import Blueprint, request, jsonify
from app.services.queue_service import get_priority_queue, claim_next_test

queue_bp = Blueprint("queue", __name__)

@queue_bp.route("", methods=["GET"])
@queue_bp.route("/", methods=["GET"])
def get_queue():
    try:
        queue = get_priority_queue()
        return jsonify({
            "success": True,
            "count": len(queue),
            "queue": queue
        })
    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 500


@queue_bp.route("/take-next", methods=["POST"])
def take_next():
    try:
        data = request.get_json(silent=True) or {}
        staff_id = data.get("staff_id") or "b0000000-0000-0000-0000-000000000001"
        result = claim_next_test(staff_id)

        if not result.get("success"):
            return jsonify(result), 400

        return jsonify(result), 200
    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 500
