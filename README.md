# LabFlow — Smart Laboratory Test Management System

A complete, full-stack, responsive healthcare SaaS web application for laboratory test registration, automatic clinical priority allocation, dynamic priority queue management, atomic technician test processing, and patient SMS/email notifications.

---

## 1. Supabase PostgreSQL Setup & Complete SQL Migration

The complete, production-grade SQL script containing all database tables, extensions, indexes, stored procedures, RLS policies, and seed data is located at:

👉 [`database/schema.sql`](file:///c:/Users/mryog/OneDrive/Documents/3rd%20sem%20El/dsa/dsael/database/schema.sql)

### How to Run in Supabase:
1. Log in to your [Supabase Dashboard](https://supabase.com).
2. Create a new project (e.g. `labflow-db`).
3. Open the **SQL Editor** from the left navigation panel.
4. Copy the entire contents of [`database/schema.sql`](file:///c:/Users/mryog/OneDrive/Documents/3rd%20sem%20El/dsa/dsael/database/schema.sql) and paste into the editor.
5. Click **Run**.
   - All 8 tables (`profiles`, `patients`, `priority_rules`, `tests`, `priority_history`, `test_assignments`, `notifications`, `activity_logs`) are created.
   - The atomic `take_next_test_atomic(p_staff_id)` stored procedure is installed.
   - The unique 5-digit tracking generator `generate_unique_tracking_number()` is installed.
   - Complete RLS security policies and initial seed data are populated.

### Connecting Supabase to the Backend:
Open [`backend/.env`](file:///c:/Users/mryog/OneDrive/Documents/3rd%20sem%20El/dsa/dsael/backend/.env) and paste your credentials:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```
*(Note: If you run the app before adding your Supabase keys, the backend automatically engages the built-in resilient database layer with local JSON persistence, so the entire app works immediately out of the box!)*

---

## 2. System Architecture & Features

### A. Role-Based Navigation & Portals
- **Home Page:** Minimalist healthcare landing page with 3 clean navigation cards (Patient Portal, Laboratory Staff, Admin Dashboard).
- **Patient Portal:** Strict two-option interface:
  1. *Register a Test:* Clean intake form with auto-generated collision-safe 5-digit tracking ID (e.g. `48291`).
  2. *Track My Test:* Real-time tracking with patient OTP verification, priority status, and verified report download/view.
- **Laboratory Staff Portal:**
  - 4 key statistics: Waiting Tests, High Priority, In Progress, Completed Today.
  - Prominent **"TAKE NEXT TEST"** button with atomic concurrency locking (`SELECT ... FOR UPDATE SKIP LOCKED`).
  - Active test workflow: Start Test, Add Remarks, Attach Report, Complete Test & Notify Patient.
- **Admin Dashboard:**
  - *Priority Review:* Manual triage fallback for tests the automatic engine could not deterministically evaluate (with HIGH, MEDIUM, LOW buttons and mandatory audit reason).
  - *Priority Rules Management:* Configurable rule conditions, test categories, and processing deadlines.
  - *Staff Management:* Roster, active workloads, account toggle.
  - *Notifications & Audit Log:* Full delivery ledger for SMS and Email channels.

### B. Automatic Priority Allocation Engine
1. **HIGH Priority:** Critical emergency biomarkers (e.g. Troponin, CK-MB, D-Dimer, CSF Gram stains).
2. **MEDIUM Priority:** Urgent inpatient panels (Comprehensive Metabolic Panel, PT/INR Coagulation, Electrolytes).
3. **LOW Priority:** Routine outpatient checkups (CBC with differential, Urinalysis).
4. **Deterministic Fallback:** If category is unmapped or ambiguous, the test enters `AWAITING_ADMIN_REVIEW` and notifies the administrator. The system **never** invents clinical decisions or assigns random priorities.

### C. Dynamic Priority Queue
- Order: **HIGH (Rank 1) $\rightarrow$ MEDIUM (Rank 2) $\rightarrow$ LOW (Rank 3)**.
- Equal Priority Tie-Break: Strict **FIFO** based on `queue_entered_at`.
- Atomic test claiming ensures multiple staff members clicking "TAKE NEXT TEST" simultaneously will never claim the same specimen.

---

## 3. Quickstart & How to Run

### Windows One-Click Launcher:
Double-click:
```cmd
run.bat
```
Located in [`dsael/run.bat`](file:///c:/Users/mryog/OneDrive/Documents/3rd%20sem%20El/dsa/dsael/run.bat).

This automatically:
1. Validates Node.js 18+.
2. Launches Express Backend on `http://127.0.0.1:5001`.
3. Launches Vite Frontend on `http://localhost:3000`.
4. Opens `http://localhost:3000` in your default browser.

### Manual Launch:
```bash
# Backend (Port 5001)
cd backend
npm install
npm start

# Frontend (Port 3000)
cd frontend
npm install
npm run dev
```

---

## 4. Default Demo Accounts

- **Administrator:** `admin@labflow.health` (Dr. Evelyn Reed - Chief Pathologist)
- **Staff 1:** `staff1@labflow.health` (Marcus Vance - Senior Lab Analyst)
- **Staff 2:** `staff2@labflow.health` (Sarah Jenkins - Biochemist)
- **Demo Patient Tracking ID:** `48291` (Verification OTP: `1234`)
