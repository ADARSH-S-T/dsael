from datetime import datetime, timezone
from app.db import local_db
from app.config import IS_SUPABASE_CONFIGURED, SUPABASE_URL, SUPABASE_KEY
import requests

def get_active_priority_rules() -> list:
    if IS_SUPABASE_CONFIGURED:
        try:
            res = requests.get(
                f"{SUPABASE_URL}/rest/v1/priority_rules?is_active=eq.true",
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}"
                },
                timeout=5
            )
            if res.ok:
                return res.json()
        except Exception as e:
            print(f"[PriorityEngine] Supabase fallback: {e}")

    return [r for r in local_db.get("priority_rules") if r.get("is_active")]


def evaluate_test_priority(test_data: dict) -> dict:
    rules = get_active_priority_rules()
    test_category = (test_data.get("test_category") or "").strip()
    test_name = (test_data.get("test_name") or "").lower()
    sample_details = (test_data.get("sample_details") or "").lower()

    # Find rules matching category (case-insensitive)
    matching_rules = [
        r for r in rules
        if (r.get("test_category") or "").strip().lower() == test_category.lower()
    ]

    if not matching_rules:
        return {
            "success": False,
            "priority": None,
            "source": None,
            "status": "AWAITING_ADMIN_REVIEW",
            "reason": f'No active priority rule found for laboratory category "{test_category}". Requires administrative triage.'
        }

    # If single rule matches category
    if len(matching_rules) == 1:
        rule = matching_rules[0]
        configured_priority = rule.get("configured_priority")
        deadline = rule.get("processing_deadline", 60)
        return {
            "success": True,
            "priority": configured_priority,
            "source": "AUTOMATIC",
            "status": "WAITING_IN_QUEUE",
            "reason": f'Matched active rule: "{rule.get("rule_name")}" ({configured_priority} priority, deadline: {deadline} mins).',
            "rule_id": rule.get("id")
        }

    # Multiple rules for category: check keyword specificity
    specific_match = None
    for rule in matching_rules:
        conditions = rule.get("rule_conditions") or {}
        keywords = conditions.get("keywords") or []
        for kw in keywords:
            if kw and (kw.lower() in test_name or kw.lower() in sample_details):
                specific_match = rule
                break
        if specific_match:
            break

    if specific_match:
        configured_priority = specific_match.get("configured_priority")
        return {
            "success": True,
            "priority": configured_priority,
            "source": "AUTOMATIC",
            "status": "WAITING_IN_QUEUE",
            "reason": f'Matched specific rule condition in: "{specific_match.get("rule_name")}" ({configured_priority}).',
            "rule_id": specific_match.get("id")
        }

    # Conflict or ambiguity: fallback to Admin Review
    return {
        "success": False,
        "priority": None,
        "source": None,
        "status": "AWAITING_ADMIN_REVIEW",
        "reason": f'Multiple rules found for category "{test_category}" with no unambiguous keyword match. Sent for medical review.'
    }


def record_priority_history(test_id: str, previous_priority: str, new_priority: str, method: str, reason: str, changed_by: str = None):
    now_iso = datetime.now(timezone.utc).isoformat()
    history_item = {
        "test_id": test_id,
        "previous_priority": previous_priority,
        "new_priority": new_priority,
        "assignment_method": method,  # 'AUTOMATIC' or 'MANUAL'
        "reason": reason,
        "changed_by": changed_by or None,
        "created_at": now_iso
    }

    if IS_SUPABASE_CONFIGURED:
        try:
            requests.post(
                f"{SUPABASE_URL}/rest/v1/priority_history",
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json"
                },
                json=history_item,
                timeout=5
            )
            return
        except Exception as e:
            print(f"[PriorityHistory] Supabase write error: {e}")

    local_db.insert("priority_history", history_item)
