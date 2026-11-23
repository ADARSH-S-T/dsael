import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseKey && 
  supabaseUrl.startsWith('http') && 
  !supabaseUrl.includes('your-project')
);

// Initial seed store matching schema.sql
const DEFAULT_STORE = {
  profiles: [
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      full_name: 'Dr. Evelyn Reed (Chief Pathologist)',
      email: 'admin@labflow.health',
      phone: '+91 98765 43210',
      role: 'admin',
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 30).toISOString()
    },
    {
      id: 'b0000000-0000-0000-0000-000000000001',
      full_name: 'Marcus Vance (Senior Lab Analyst)',
      email: 'staff1@labflow.health',
      phone: '+91 98765 43211',
      role: 'staff',
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 20).toISOString()
    },
    {
      id: 'b0000000-0000-0000-0000-000000000002',
      full_name: 'Sarah Jenkins (Biochemist)',
      email: 'staff2@labflow.health',
      phone: '+91 98765 43212',
      role: 'staff',
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 10).toISOString()
    }
  ],
  patients: [
    {
      id: 'c0000000-0000-0000-0000-000000000001',
      full_name: 'Eleanor Vance',
      phone: '+91 91234 56789',
      email: 'eleanor.vance@example.com',
      age: 48,
      gender: 'Female',
      created_at: new Date(Date.now() - 3600000 * 5).toISOString()
    },
    {
      id: 'c0000000-0000-0000-0000-000000000002',
      full_name: 'Vikramaditya Roy',
      phone: '+91 98765 12345',
      email: 'vikram.roy@example.com',
      age: 62,
      gender: 'Male',
      created_at: new Date(Date.now() - 3600000 * 4).toISOString()
    },
    {
      id: 'c0000000-0000-0000-0000-000000000003',
      full_name: 'Anita Sharma',
      phone: '+91 97890 23456',
      email: 'anita.sharma@example.com',
      age: 29,
      gender: 'Female',
      created_at: new Date(Date.now() - 3600000 * 3).toISOString()
    },
    {
      id: 'c0000000-0000-0000-0000-000000000004',
      full_name: 'David Kim',
      phone: '+91 96543 34567',
      email: 'david.kim@example.com',
      age: 35,
      gender: 'Male',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      id: 'c0000000-0000-0000-0000-000000000005',
      full_name: 'Rachel Green',
      phone: '+91 95432 45678',
      email: 'rachel.green@example.com',
      age: 41,
      gender: 'Female',
      created_at: new Date(Date.now() - 3600000 * 1).toISOString()
    }
  ],
  priority_rules: [
    {
      id: 'r0000000-0000-0000-0000-000000000001',
      rule_name: 'Critical Cardiac & Trauma Biomarkers',
      test_category: 'Cardiac & Emergency',
      configured_priority: 'HIGH',
      rule_conditions: { keywords: ['Troponin', 'CK-MB', 'D-Dimer', 'Arterial Blood Gas'], max_tat_mins: 30 },
      processing_deadline: 30,
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'r0000000-0000-0000-0000-000000000002',
      rule_name: 'Infectious Cerebrospinal & Spinal Fluid Panels',
      test_category: 'Microbiology & CSF',
      configured_priority: 'HIGH',
      rule_conditions: { keywords: ['Spinal Fluid', 'CSF', 'Gram Stain', 'Blood Culture'], max_tat_mins: 45 },
      processing_deadline: 45,
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'r0000000-0000-0000-0000-000000000003',
      rule_name: 'Urgent Comprehensive Metabolic Panels',
      test_category: 'Biochemistry',
      configured_priority: 'MEDIUM',
      rule_conditions: { keywords: ['CMP', 'Electrolytes', 'Renal', 'Liver Function', 'Lipid'], max_tat_mins: 90 },
      processing_deadline: 90,
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'r0000000-0000-0000-0000-000000000004',
      rule_name: 'Coagulation & Thrombosis Profiling',
      test_category: 'Coagulation',
      configured_priority: 'MEDIUM',
      rule_conditions: { keywords: ['PT/INR', 'aPTT', 'Fibrinogen'], max_tat_mins: 60 },
      processing_deadline: 60,
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'r0000000-0000-0000-0000-000000000005',
      rule_name: 'Routine Complete Blood Count & Smear',
      test_category: 'Hematology',
      configured_priority: 'LOW',
      rule_conditions: { keywords: ['CBC', 'Hemoglobin', 'ESR', 'Blood Smear'], max_tat_mins: 180 },
      processing_deadline: 180,
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'r0000000-0000-0000-0000-000000000006',
      rule_name: 'Routine Urinalysis & Clinical Microscopy',
      test_category: 'Urinalysis',
      configured_priority: 'LOW',
      rule_conditions: { keywords: ['Urine Routine', 'Urine Culture', 'Specific Gravity'], max_tat_mins: 240 },
      processing_deadline: 240,
      is_active: true,
      created_at: new Date().toISOString()
    }
  ],
  tests: [
    {
      id: 'd0000000-0000-0000-0000-000000000001',
      tracking_number: '48291',
      patient_id: 'c0000000-0000-0000-0000-000000000001',
      test_name: 'High-Sensitivity Troponin I (STAT)',
      test_category: 'Cardiac & Emergency',
      sample_type: 'Serum / Whole Blood',
      sample_details: '3mL EDTA Tube - Hemolysis negative',
      additional_information: 'Patient experiencing severe chest pain radiation',
      priority: 'HIGH',
      priority_source: 'AUTOMATIC',
      priority_reason: 'Matched active rule: Critical Cardiac & Trauma Biomarkers (Rule Deadline 30m)',
      status: 'WAITING_IN_QUEUE',
      queue_entered_at: new Date(Date.now() - 1500000).toISOString(),
      registered_at: new Date(Date.now() - 1800000).toISOString(),
      assigned_to: null,
      started_at: null,
      completed_at: null,
      report_path: null,
      remarks: null
    },
    {
      id: 'd0000000-0000-0000-0000-000000000002',
      tracking_number: '59102',
      patient_id: 'c0000000-0000-0000-0000-000000000002',
      test_name: 'Cerebrospinal Fluid Culture & Gram Stain',
      test_category: 'Microbiology & CSF',
      sample_type: 'CSF Fluid',
      sample_details: '2mL Lumbar Puncture specimen in sterile container',
      additional_information: 'Meningitis suspicion',
      priority: 'HIGH',
      priority_source: 'AUTOMATIC',
      priority_reason: 'Matched active rule: Infectious Cerebrospinal & Spinal Fluid Panels',
      status: 'WAITING_IN_QUEUE',
      queue_entered_at: new Date(Date.now() - 900000).toISOString(),
      registered_at: new Date(Date.now() - 1200000).toISOString(),
      assigned_to: null,
      started_at: null,
      completed_at: null,
      report_path: null,
      remarks: null
    },
    {
      id: 'd0000000-0000-0000-0000-000000000003',
      tracking_number: '61043',
      patient_id: 'c0000000-0000-0000-0000-000000000003',
      test_name: 'Comprehensive Metabolic Panel (CMP)',
      test_category: 'Biochemistry',
      sample_type: 'Serum',
      sample_details: '5mL SST Gold-top tube centrifuged',
      additional_information: 'Pre-operative clearance',
      priority: 'MEDIUM',
      priority_source: 'AUTOMATIC',
      priority_reason: 'Matched active rule: Urgent Comprehensive Metabolic Panels',
      status: 'WAITING_IN_QUEUE',
      queue_entered_at: new Date(Date.now() - 2400000).toISOString(),
      registered_at: new Date(Date.now() - 2700000).toISOString(),
      assigned_to: null,
      started_at: null,
      completed_at: null,
      report_path: null,
      remarks: null
    },
    {
      id: 'd0000000-0000-0000-0000-000000000004',
      tracking_number: '72418',
      patient_id: 'c0000000-0000-0000-0000-000000000004',
      test_name: 'Complete Blood Count (CBC) with Differential',
      test_category: 'Hematology',
      sample_type: 'Whole Blood',
      sample_details: '4mL Lavender EDTA vial',
      additional_information: 'Annual executive checkup',
      priority: 'LOW',
      priority_source: 'AUTOMATIC',
      priority_reason: 'Matched active rule: Routine Complete Blood Count & Smear',
      status: 'WAITING_IN_QUEUE',
      queue_entered_at: new Date(Date.now() - 3600000).toISOString(),
      registered_at: new Date(Date.now() - 3900000).toISOString(),
      assigned_to: null,
      started_at: null,
      completed_at: null,
      report_path: null,
      remarks: null
    },
    {
      id: 'd0000000-0000-0000-0000-000000000005',
      tracking_number: '83920',
      patient_id: 'c0000000-0000-0000-0000-000000000005',
      test_name: 'Uncommon Autoimmune Antinuclear Antibody Panel',
      test_category: 'Immunology / Specialized',
      sample_type: 'Serum',
      sample_details: 'Specialty frozen aliquoted plasma',
      additional_information: 'Specialized lab referral',
      priority: null,
      priority_source: null,
      priority_reason: 'No matching active rule for category "Immunology / Specialized". Sent for manual medical review.',
      status: 'AWAITING_ADMIN_REVIEW',
      queue_entered_at: null,
      registered_at: new Date(Date.now() - 600000).toISOString(),
      assigned_to: null,
      started_at: null,
      completed_at: null,
      report_path: null,
      remarks: null
    },
    {
      id: 'd0000000-0000-0000-0000-000000000006',
      tracking_number: '34912',
      patient_id: 'c0000000-0000-0000-0000-000000000003',
      test_name: 'Routine Lipid Profile with ApoB',
      test_category: 'Biochemistry',
      sample_type: 'Serum',
      sample_details: '5mL Fasting blood drawn at 08:00 AM',
      additional_information: 'Follow-up statin titration',
      priority: 'MEDIUM',
      priority_source: 'AUTOMATIC',
      priority_reason: 'Matched active rule: Urgent Comprehensive Metabolic Panels',
      status: 'COMPLETED',
      queue_entered_at: new Date(Date.now() - 10800000).toISOString(),
      registered_at: new Date(Date.now() - 12600000).toISOString(),
      started_at: new Date(Date.now() - 7200000).toISOString(),
      completed_at: new Date(Date.now() - 3600000).toISOString(),
      assigned_to: 'b0000000-0000-0000-0000-000000000001',
      report_path: '/reports/34912_LipidProfile.pdf',
      remarks: 'All lipid fractions within normal clinical reference ranges. Report released and verified.'
    }
  ],
  priority_history: [],
  test_assignments: [],
  notifications: [
    {
      id: 'n0000000-0000-0000-0000-000000000001',
      test_id: 'd0000000-0000-0000-0000-000000000006',
      patient_id: 'c0000000-0000-0000-0000-000000000003',
      notification_type: 'COMPLETED',
      channel: 'SMS',
      recipient: '+91 97890 23456',
      message: 'Your laboratory test has been completed successfully. Tracking ID: 34912. Please visit the LabFlow portal to check your test status and access your report.',
      delivery_status: 'SENT',
      provider_response: { status: 'delivered', provider: 'Twilio/Indian SMS Gateway' },
      sent_at: new Date(Date.now() - 3600000).toISOString(),
      created_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'n0000000-0000-0000-0000-000000000002',
      test_id: 'd0000000-0000-0000-0000-000000000001',
      patient_id: 'c0000000-0000-0000-0000-000000000001',
      notification_type: 'REGISTRATION',
      channel: 'EMAIL',
      recipient: 'eleanor.vance@example.com',
      message: 'Test Registered Successfully. Your Tracking ID: 48291. Priority assigned: HIGH (Critical Cardiac & Emergency).',
      delivery_status: 'SENT',
      provider_response: { status: 'delivered', provider: 'Resend Email Gateway' },
      sent_at: new Date(Date.now() - 1800000).toISOString(),
      created_at: new Date(Date.now() - 1800000).toISOString()
    }
  ],
  activity_logs: [
    {
      id: 'l0000000-0000-0000-0000-000000000001',
      user_id: 'a0000000-0000-0000-0000-000000000001',
      action: 'SYSTEM_INITIALIZED',
      entity_type: 'system',
      entity_id: null,
      details: { version: '1.0.0', engine: 'Dynamic Priority Queue + Rule Evaluator' },
      created_at: new Date(Date.now() - 86400000).toISOString()
    }
  ]
};

// Resilient In-Memory & File Store Adapter
class LocalDbAdapter {
  constructor() {
    this.store = this.loadStore();
  }

  loadStore() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[LabFlow DB] Loading from defaults:', e.message);
    }
    this.saveStore(DEFAULT_STORE);
    return JSON.parse(JSON.stringify(DEFAULT_STORE));
  }

  saveStore(data) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_FILE, JSON.stringify(data || this.store, null, 2), 'utf-8');
    } catch (e) {
      console.error('[LabFlow DB] Could not persist store:', e.message);
    }
  }

  get(table) {
    if (!this.store[table]) this.store[table] = [];
    return this.store[table];
  }

  insert(table, item) {
    if (!this.store[table]) this.store[table] = [];
    const record = {
      id: item.id || crypto.randomUUID(),
      created_at: item.created_at || new Date().toISOString(),
      ...item
    };
    this.store[table].push(record);
    this.saveStore();
    return record;
  }

  update(table, id, updates) {
    if (!this.store[table]) return null;
    const idx = this.store[table].findIndex(x => x.id === id);
    if (idx === -1) return null;
    this.store[table][idx] = {
      ...this.store[table][idx],
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.saveStore();
    return this.store[table][idx];
  }

  delete(table, id) {
    if (!this.store[table]) return false;
    const initialLen = this.store[table].length;
    this.store[table] = this.store[table].filter(x => x.id !== id);
    const deleted = this.store[table].length < initialLen;
    if (deleted) this.saveStore();
    return deleted;
  }
}

export const localDb = new LocalDbAdapter();

// Supabase client instance (or null if credentials pending)
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null;

if (isSupabaseConfigured) {
  console.log(`[LabFlow DB] Connected to Supabase PostgreSQL at ${supabaseUrl}`);
} else {
  console.log(`[LabFlow DB] Supabase credentials not set in .env. Running on built-in Resilient Store with JSON persistence.`);
  console.log(`[LabFlow DB] Paste your SUPABASE_URL and SUPABASE_ANON_KEY into backend/.env anytime to switch live!`);
}
