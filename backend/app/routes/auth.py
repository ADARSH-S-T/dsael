import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from app.db import local_db
from app.config import IS_SUPABASE_CONFIGURED, SUPABASE_URL, SUPABASE_KEY
import requests

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    role = data.get("role", "staff").strip().lower()

    if not email:
        return jsonify({"success": False, "error": "Email is required"}), 400

    profile = None
    if IS_SUPABASE_CONFIGURED:
        try:
            res = requests.get(
                f"{SUPABASE_URL}/rest/v1/profiles?email=eq.{email}&select=*",
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}"
                },
                timeout=5
            )
            if res.ok and res.json():
                profile = res.json()[0]
        except Exception as e:
            print(f"[Auth] Supabase profile fetch error: {e}")

    if not profile:
        profile = next(
            (p for p in local_db.get("profiles") if p.get("email", "").lower() == email),
            None
        )

    # If profile does not exist yet, auto-create for demo/testing convenience
    if not profile:
        new_profile = {
            "id": str(uuid.uuid4()),
            "full_name": "System Administrator" if role == "admin" else "Laboratory Technician",
            "email": email,
            "phone": "+91 98765 00000",
            "role": role or "staff",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        if IS_SUPABASE_CONFIGURED:
            try:
                res = requests.post(
                    f"{SUPABASE_URL}/rest/v1/profiles",
                    headers={
                        "apikey": SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY}",
                        "Content-Type": "application/json",
                        "Prefer": "return=representation"
                    },
                    json=new_profile,
                    timeout=5
                )
                if res.ok and res.json():
                    profile = res.json()[0]
            except Exception as e:
                print(f"[Auth] Supabase profile creation error: {e}")

        if not profile:
            profile = local_db.insert("profiles", new_profile)

    if not profile.get("is_active"):
        return jsonify({"success": False, "error": "User account is deactivated. Contact administrator."}), 403

    return jsonify({
        "success": True,
        "message": "Login successful",
        "user": profile,
        "token": f"labflow_token_{profile.get('id')}"
    })


@auth_bp.route("/me", methods=["GET"])
def get_me():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        admin = next((p for p in local_db.get("profiles") if p.get("role") == "admin"), None)
        return jsonify({"success": True, "user": admin})

    user_id = auth_header.replace("Bearer labflow_token_", "").strip()
    profile = next((p for p in local_db.get("profiles") if p.get("id") == user_id), None)
    return jsonify({"success": True, "user": profile})


@auth_bp.route("/staff-users", methods=["GET"])
def get_staff_users():
    staff = [p for p in local_db.get("profiles") if p.get("role") == "staff"]
    return jsonify({"success": True, "staff": staff})
