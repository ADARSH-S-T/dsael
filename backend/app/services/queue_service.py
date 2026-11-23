from datetime import datetime, timezone
from app.db import local_db
from app.config import IS_SUPABASE_CONFIGURED, SUPABASE_URL, SUPABASE_KEY
import requests

PRIORITY_WEIGHTS = {
    "HIGH": 1,
    "MEDIUM": 2,
    "LOW": 3
}

def parse_iso(dt_str):
    if not dt_str:
        return 0
    try:
        if dt_str.endswith("Z"):
            dt_str = dt_str[:-1] + "+00:00"
        return datetime.fromisoformat(dt_str).timestamp()
    except Exception:
        return 0


def calculate_waiting_time(queue_entered_at: str) -> str:
    if not queue_entered_at:
        return "0m"
    try:
        ts = parse_iso(queue_entered_at)
        now_ts = datetime.now(timezone.utc).timestamp()
        diff_secs = max(0, int(now_ts - ts))
        mins = diff_secs // 60
        if mins < 60:
            return f"{mins}m"
        hours = mins // 60
        rem_mins = mins % 60
        return f"{hours}h {rem_mins}m"
    except Exception:
        return "0m"


def get_priority_queue() -> list:
    waiting_tests = []

    if IS_SUPABASE_CONFIGURED:
        try:
            res = requests.get(
                f"{SUPABASE_URL}/rest/v1/tests?status=eq.WAITING_IN_QUEUE&select=*,patient:patient_id(full_name,phone,email,age,gender)",
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}"
                },
                timeout=5
            )
            if res.ok:
                waiting_tests = res.json()
        except Exception as e:
            print(f"[QueueService] Supabase query fallback: {e}")

    if not waiting_tests:
        tests = [t for t in local_db.get("tests") if t.get("status") == "WAITING_IN_QUEUE"]
        patients = {p["id"]: p for p in local_db.get("patients")}
        waiting_tests = []
        for t in tests:
            t_copy = dict(t)
            t_copy["patient"] = patients.get(t.get("patient_id"))
            waiting_tests.append(t_copy)

    # Sort primarily by priority weight (1, 2, 3), then FIFO by queue_entered_at or registered_at
    def sort_key(item):
        weight = PRIORITY_WEIGHTS.get(item.get("priority"), 99)
        time_key = parse_iso(item.get("queue_entered_at") or item.get("registered_at"))
        return (weight, time_key)

    waiting_tests.sort(key=sort_key)

    # Assign queue position and waiting duration
    result = []
    for idx, t in enumerate(waiting_tests):
        item = dict(t)
        item["queue_position"] = idx + 1
        item["waiting_time"] = calculate_waiting_time(t.get("queue_entered_at"))
        result.append(item)

    return result


def claim_next_test(staff_id: str) -> dict:
    if IS_SUPABASE_CONFIGURED:
        try:
            # Attempt atomic Postgres stored procedure via RPC
            rpc_res = requests.post(
                f"{SUPABASE_URL}/rest/v1/rpc/take_next_test_atomic",
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json"
                },
                json={"p_staff_id": staff_id},
                timeout=5
            )
            if rpc_res.ok:
                return rpc_res.json()
        except Exception as e:
            print(f"[QueueService] Supabase RPC error: {e}")

    # Local resilient atomic lock simulation
    queue = get_priority_queue()
    if not queue:
        return {
            "success": False,
            "message": "No eligible tests waiting in the priority queue at this time."
        }

    highest_priority_test = queue[0]
    now_iso = datetime.now(timezone.utc).isoformat()

    # Atomically update test
    updated_test = local_db.update("tests", highest_priority_test["id"], {
        "status": "ASSIGNED",
        "assigned_to": staff_id,
        "updated_at": now_iso
    })

    # Record assignment
    local_db.insert("test_assignments", {
        "test_id": highest_priority_test["id"],
        "staff_id": staff_id,
        "assigned_at": now_iso
    })

    # Log activity
    local_db.insert("activity_logs", {
        "user_id": staff_id,
        "action": "CLAIMED_TEST",
        "entity_type": "test",
        "entity_id": highest_priority_test["id"],
        "details": {
            "tracking_number": highest_priority_test.get("tracking_number"),
            "priority": highest_priority_test.get("priority"),
            "test_name": highest_priority_test.get("test_name")
        }
    })

    return {
        "success": True,
        "message": "Test claimed successfully.",
        "test": updated_test
    }
