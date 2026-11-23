import os
from pathlib import Path
from dotenv import load_dotenv

# Base Directory paths
BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BACKEND_DIR / ".env"
DATA_DIR = BACKEND_DIR / "data"
STORE_FILE = DATA_DIR / "store.json"

# Load environment variables
load_dotenv(dotenv_path=ENV_PATH)

PORT = int(os.getenv("PORT", 5001))
HOST = os.getenv("HOST", "0.0.0.0")

# Supabase Credentials
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY

IS_SUPABASE_CONFIGURED = bool(
    SUPABASE_URL
    and SUPABASE_KEY
    and SUPABASE_URL.startswith("http")
    and "your-project" not in SUPABASE_URL
)

# SMS & Email Provider Credentials
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "").strip()

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
FROM_EMAIL = os.getenv("FROM_EMAIL", "notifications@labflow.health").strip()

JWT_SECRET = os.getenv("JWT_SECRET", "labflow_super_secret_enterprise_jwt_key_2026")
