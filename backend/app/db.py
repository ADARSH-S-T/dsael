import json
import os
import uuid
import threading
from datetime import datetime, timezone, timedelta
from app.config import DATA_DIR, STORE_FILE, IS_SUPABASE_CONFIGURED, SUPABASE_URL, SUPABASE_KEY

now_utc = datetime.now(timezone.utc)

def iso_now(offset_seconds=0):
    return (datetime.now(timezone.utc) + timedelta(seconds=offset_seconds)).isoformat()

DEFAULT_STORE = {
    "profiles": [
        {
            "id": "a0000000-0000-0000-0000-000000000001",
            "full_name": "Dr. Evelyn Reed (Chief Pathologist)",
            "email": "admin@labflow.health",
            "phone": "+91 98765 43210",
            "role": "admin",
            "is_active": True,
            "created_at": iso_now(-86400 * 30)
        },
        {
            "id": "b0000000-0000-0000-0000-000000000001",
            "full_name": "Marcus Vance (Senior Lab Analyst)",
            "email": "staff1@labflow.health",
            "phone": "+91 98765 43211",
            "role": "staff",
            "is_active": True,
            "created_at": iso_now(-86400 * 20)
        },
        {
            "id": "b0000000-0000-0000-0000-000000000002",
            "full_name": "Sarah Jenkins (Biochemist)",
            "email": "staff2@labflow.health",
            "phone": "+91 98765 43212",
            "role": "staff",
            "is_active": True,
            "created_at": iso_now(-86400 * 10)
        }
    ],
    "patients": [
        {
            "id": "c0000000-0000-0000-0000-000000000001",
            "full_name": "Eleanor Vance",
            "phone": "+91 91234 56789",
            "email": "eleanor.vance@example.com",
            "age": 48,
            "gender": "Female",
            "created_at": iso_now(-3600 * 5)
        },
        {
            "id": "c0000000-0000-0000-0000-000000000002",
            "full_name": "Vikramaditya Roy",
            "phone": "+91 98765 12345",
            "email": "vikram.roy@example.com",
            "age": 62,
            "gender": "Male",
            "created_at": iso_now(-3600 * 4)
        },
        {
            "id": "c0000000-0000-0000-0000-000000000003",
            "full_name": "Anita Sharma",
            "phone": "+91 97890 23456",
            "email": "anita.sharma@example.com",
            "age": 29,
            "gender": "Female",
            "created_at": iso_now(-3600 * 3)
        },
        {
            "id": "c0000000-0000-0000-0000-000000000004",
            "full_name": "David Kim",
            "phone": "+91 96543 34567",
            "email": "david.kim@example.com",
            "age": 35,
            "gender": "Male",
            "created_at": iso_now(-3600 * 2)
        },
        {
            "id": "c0000000-0000-0000-0000-000000000005",
            "full_name": "Rachel Green",
            "phone": "+91 95432 45678",
            "email": "rachel.green@example.com",
            "age": 41,
            "gender": "Female",
            "created_at": iso_now(-3600 * 1)
        }
    ],
    "priority_rules": [
        {
            "id": "r0000000-0000-0000-0000-000000000001",
            "rule_name": "Critical Cardiac & Trauma Biomarkers",
            "test_category": "Cardiac & Emergency",
            "configured_priority": "HIGH",
            "rule_conditions": {"keywords": ["Troponin", "CK-MB", "D-Dimer", "Arterial Blood Gas"], "max_tat_mins": 30},
            "processing_deadline": 30,
            "is_active": True,
            "created_at": iso_now()
        },
        {
            "id": "r0000000-0000-0000-0000-000000000002",
            "rule_name": "Infectious Cerebrospinal & Spinal Fluid Panels",
            "test_category": "Microbiology & CSF",
            "configured_priority": "HIGH",
            "rule_conditions": {"keywords": ["Spinal Fluid", "CSF", "Gram Stain", "Blood Culture"], "max_tat_mins": 45},
            "processing_deadline": 45,
            "is_active": True,
            "created_at": iso_now()
        },
        {
            "id": "r0000000-0000-0000-0000-000000000003",
            "rule_name": "Urgent Comprehensive Metabolic Panels",
            "test_category": "Biochemistry",
            "configured_priority": "MEDIUM",
            "rule_conditions": {"keywords": ["CMP", "Electrolytes", "Renal", "Liver Function", "Lipid"], "max_tat_mins": 90},
            "processing_deadline": 90,
            "is_active": True,
            "created_at": iso_now()
        },
        {
            "id": "r0000000-0000-0000-0000-000000000004",
            "rule_name": "Coagulation & Thrombosis Profiling",
            "test_category": "Coagulation",
            "configured_priority": "MEDIUM",
            "rule_conditions": {"keywords": ["PT/INR", "aPTT", "Fibrinogen"], "max_tat_mins": 60},
            "processing_deadline": 60,
            "is_active": True,
            "created_at": iso_now()
        },
        {
            "id": "r0000000-0000-0000-0000-000000000005",
            "rule_name": "Routine Complete Blood Count & Smear",
            "test_category": "Hematology",
            "configured_priority": "LOW",
            "rule_conditions": {"keywords": ["CBC", "Hemoglobin", "ESR", "Blood Smear"], "max_tat_mins": 180},
            "processing_deadline": 180,
            "is_active": True,
            "created_at": iso_now()
        },
        {
            "id": "r0000000-0000-0000-0000-000000000006",
            "rule_name": "Routine Urinalysis & Clinical Microscopy",
            "test_category": "Urinalysis",
            "configured_priority": "LOW",
            "rule_conditions": {"keywords": ["Urine Routine", "Urine Culture", "Specific Gravity"], "max_tat_mins": 240},
            "processing_deadline": 240,
            "is_active": True,
            "created_at": iso_now()
        }
    ],
    "tests": [
        {
            "id": "d0000000-0000-0000-0000-000000000001",
            "tracking_number": "48291",
            "patient_id": "c0000000-0000-0000-0000-000000000001",
            "test_name": "High-Sensitivity Troponin I (STAT)",
            "test_category": "Cardiac & Emergency",
            "sample_type": "Serum / Whole Blood",
            "sample_details": "3mL EDTA Tube - Hemolysis negative",
            "additional_information": "Patient experiencing severe chest pain radiation",
            "priority": "HIGH",
            "priority_source": "AUTOMATIC",
            "priority_reason": "Matched active rule: Critical Cardiac & Trauma Biomarkers (Rule Deadline 30m)",
            "status": "WAITING_IN_QUEUE",
            "queue_entered_at": iso_now(-1500),
            "registered_at": iso_now(-1800),
            "assigned_to": None,
            "started_at": None,
            "completed_at": None,
            "report_path": None,
            "remarks": None
        },
        {
            "id": "d0000000-0000-0000-0000-000000000002",
            "tracking_number": "59102",
            "patient_id": "c0000000-0000-0000-0000-000000000002",
            "test_name": "Cerebrospinal Fluid Culture & Gram Stain",
            "test_category": "Microbiology & CSF",
            "sample_type": "CSF Fluid",
            "sample_details": "2mL Lumbar Puncture specimen in sterile container",
            "additional_information": "Meningitis suspicion",
            "priority": "HIGH",
            "priority_source": "AUTOMATIC",
            "priority_reason": "Matched active rule: Infectious Cerebrospinal & Spinal Fluid Panels",
            "status": "WAITING_IN_QUEUE",
            "queue_entered_at": iso_now(-900),
            "registered_at": iso_now(-1200),
            "assigned_to": None,
            "started_at": None,
            "completed_at": None,
            "report_path": None,
            "remarks": None
        },
        {
            "id": "d0000000-0000-0000-0000-000000000003",
            "tracking_number": "61043",
            "patient_id": "c0000000-0000-0000-0000-000000000003",
            "test_name": "Comprehensive Metabolic Panel (CMP)",
            "test_category": "Biochemistry",
            "sample_type": "Serum",
            "sample_details": "5mL SST Gold-top tube centrifuged",
            "additional_information": "Pre-operative clearance",
            "priority": "MEDIUM",
            "priority_source": "AUTOMATIC",
            "priority_reason": "Matched active rule: Urgent Comprehensive Metabolic Panels",
            "status": "WAITING_IN_QUEUE",
            "queue_entered_at": iso_now(-2400),
            "registered_at": iso_now(-2700),
            "assigned_to": None,
            "started_at": None,
            "completed_at": None,
            "report_path": None,
            "remarks": None
        },
        {
            "id": "d0000000-0000-0000-0000-000000000004",
            "tracking_number": "72418",
            "patient_id": "c0000000-0000-0000-0000-000000000004",
            "test_name": "Complete Blood Count (CBC) with Differential",
            "test_category": "Hematology",
            "sample_type": "Whole Blood",
            "sample_details": "4mL Lavender EDTA vial",
            "additional_information": "Annual executive checkup",
            "priority": "LOW",
            "priority_source": "AUTOMATIC",
            "priority_reason": "Matched active rule: Routine Complete Blood Count & Smear",
            "status": "WAITING_IN_QUEUE",
            "queue_entered_at": iso_now(-3600),
            "registered_at": iso_now(-3900),
            "assigned_to": None,
            "started_at": None,
            "completed_at": None,
            "report_path": None,
            "remarks": None
        },
        {
            "id": "d0000000-0000-0000-0000-000000000005",
            "tracking_number": "83920",
            "patient_id": "c0000000-0000-0000-0000-000000000005",
            "test_name": "Uncommon Autoimmune Antinuclear Antibody Panel",
            "test_category": "Immunology / Specialized",
            "sample_type": "Serum",
            "sample_details": "Specialty frozen aliquoted plasma",
            "additional_information": "Specialized lab referral",
            "priority": None,
            "priority_source": None,
            "priority_reason": "No matching active rule for category \"Immunology / Specialized\". Sent for manual medical review.",
            "status": "AWAITING_ADMIN_REVIEW",
            "queue_entered_at": None,
            "registered_at": iso_now(-600),
            "assigned_to": None,
            "started_at": None,
            "completed_at": None,
            "report_path": None,
            "remarks": None
        },
        {
            "id": "d0000000-0000-0000-0000-000000000006",
            "tracking_number": "34912",
            "patient_id": "c0000000-0000-0000-0000-000000000003",
            "test_name": "Routine Lipid Profile with ApoB",
            "test_category": "Biochemistry",
            "sample_type": "Serum",
            "sample_details": "5mL Fasting blood drawn at 08:00 AM",
            "additional_information": "Follow-up statin titration",
            "priority": "MEDIUM",
            "priority_source": "AUTOMATIC",
            "priority_reason": "Matched active rule: Urgent Comprehensive Metabolic Panels",
            "status": "COMPLETED",
            "queue_entered_at": iso_now(-10800),
            "registered_at": iso_now(-12600),
            "started_at": iso_now(-7200),
            "completed_at": iso_now(-3600),
            "assigned_to": "b0000000-0000-0000-0000-000000000001",
            "report_path": "/reports/34912_LipidProfile.pdf",
            "remarks": "All lipid fractions within normal clinical reference ranges. Report released and verified."
        }
    ],
    "priority_history": [],
    "test_assignments": [],
    "notifications": [
        {
            "id": "n0000000-0000-0000-0000-000000000001",
            "test_id": "d0000000-0000-0000-0000-000000000006",
            "patient_id": "c0000000-0000-0000-0000-000000000003",
            "notification_type": "COMPLETED",
            "channel": "SMS",
            "recipient": "+91 97890 23456",
            "message": "Your laboratory test has been completed successfully. Tracking ID: 34912. Please visit the LabFlow portal to check your test status and access your report.",
            "delivery_status": "SENT",
            "provider_response": {"status": "delivered", "provider": "Twilio/Indian SMS Gateway"},
            "sent_at": iso_now(-3600),
            "created_at": iso_now(-3600)
        },
        {
            "id": "n0000000-0000-0000-0000-000000000002",
            "test_id": "d0000000-0000-0000-0000-000000000001",
            "patient_id": "c0000000-0000-0000-0000-000000000001",
            "notification_type": "REGISTRATION",
            "channel": "EMAIL",
            "recipient": "eleanor.vance@example.com",
            "message": "Test Registered Successfully. Your Tracking ID: 48291. Priority assigned: HIGH (Critical Cardiac & Emergency).",
            "delivery_status": "SENT",
            "provider_response": {"status": "delivered", "provider": "Resend Email Gateway"},
            "sent_at": iso_now(-1800),
            "created_at": iso_now(-1800)
        }
    ],
    "activity_logs": [
        {
            "id": "l0000000-0000-0000-0000-000000000001",
            "user_id": "a0000000-0000-0000-0000-000000000001",
            "action": "SYSTEM_INITIALIZED",
            "entity_type": "system",
            "entity_id": None,
            "details": {"version": "1.0.0", "engine": "Dynamic Priority Queue + Rule Evaluator (Flask)"},
            "created_at": iso_now(-86400)
        }
    ]
}


class LocalDbAdapter:
    def __init__(self):
        self.lock = threading.Lock()
        self.store = self.load_store()

    def load_store(self):
        with self.lock:
            try:
                os.makedirs(DATA_DIR, exist_ok=True)
                if os.path.exists(STORE_FILE):
                    with open(STORE_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        # Check that all keys exist
                        for key in DEFAULT_STORE:
                            if key not in data:
                                data[key] = DEFAULT_STORE[key]
                        return data
            except Exception as e:
                print(f"[LabFlow DB] Warning loading store: {e}")

            self._save_store(DEFAULT_STORE)
            return json.loads(json.dumps(DEFAULT_STORE))

    def _save_store(self, data=None):
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            target = data if data is not None else self.store
            with open(STORE_FILE, "w", encoding="utf-8") as f:
                json.dump(target, f, indent=2, default=str)
        except Exception as e:
            print(f"[LabFlow DB] Could not persist store: {e}")

    def save_store(self):
        with self.lock:
            self._save_store()

    def get(self, table: str) -> list:
        with self.lock:
            if table not in self.store:
                self.store[table] = []
            # Return shallow copy of list so mutations are explicit
            return list(self.store[table])

    def insert(self, table: str, item: dict) -> dict:
        with self.lock:
            if table not in self.store:
                self.store[table] = []
            record = {
                "id": item.get("id") or str(uuid.uuid4()),
                "created_at": item.get("created_at") or datetime.now(timezone.utc).isoformat(),
                **item
            }
            self.store[table].append(record)
            self._save_store()
            return record

    def update(self, table: str, record_id: str, updates: dict):
        with self.lock:
            if table not in self.store:
                return None
            for idx, r in enumerate(self.store[table]):
                if r.get("id") == record_id:
                    updated = {
                        **r,
                        **updates,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                    self.store[table][idx] = updated
                    self._save_store()
                    return updated
            return None

    def delete(self, table: str, record_id: str) -> bool:
        with self.lock:
            if table not in self.store:
                return False
            initial_len = len(self.store[table])
            self.store[table] = [r for r in self.store[table] if r.get("id") != record_id]
            deleted = len(self.store[table]) < initial_len
            if deleted:
                self._save_store()
            return deleted


local_db = LocalDbAdapter()

if IS_SUPABASE_CONFIGURED:
    print(f"[LabFlow DB] Supabase URL detected: {SUPABASE_URL}")
else:
    print("[LabFlow DB] Supabase credentials not set in .env. Running on built-in Resilient Store with JSON persistence.")
