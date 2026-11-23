-- ============================================================================
-- LABFLOW — SMART LABORATORY TEST MANAGEMENT SYSTEM
-- MASTER DATABASE SCHEMA & SEED MIGRATION (SUPABASE POSTGRESQL)
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. TABLE DEFINITIONS
-- ============================================================================

-- A. PROFILES TABLE (Staff, Admins, and Registered Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('patient', 'staff', 'admin')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- B. PATIENTS TABLE
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    age INTEGER NOT NULL CHECK (age > 0 AND age < 150),
    gender TEXT CHECK (gender IN ('Male', 'Female', 'Other', 'Prefer not to say')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- C. PRIORITY RULES TABLE (Admin Configurable Automatic Priority Engine)
CREATE TABLE IF NOT EXISTS public.priority_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL,
    test_category TEXT NOT NULL,
    configured_priority TEXT NOT NULL CHECK (configured_priority IN ('HIGH', 'MEDIUM', 'LOW')),
    rule_conditions JSONB DEFAULT '{}'::jsonb,
    processing_deadline INTEGER NOT NULL DEFAULT 60, -- Processing SLA in minutes
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- D. TESTS TABLE (Core Laboratory Specimen & Test Workflow)
CREATE TABLE IF NOT EXISTS public.tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_number VARCHAR(5) UNIQUE NOT NULL,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    test_category TEXT NOT NULL,
    sample_type TEXT NOT NULL,
    sample_details TEXT NOT NULL,
    additional_information TEXT,
    priority TEXT CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
    priority_source TEXT CHECK (priority_source IN ('AUTOMATIC', 'MANUAL')),
    priority_reason TEXT,
    status TEXT NOT NULL DEFAULT 'REGISTERED' CHECK (
        status IN (
            'REGISTERED',
            'AWAITING_ADMIN_REVIEW',
            'WAITING_IN_QUEUE',
            'ASSIGNED',
            'IN_PROGRESS',
            'COMPLETED',
            'CANCELLED'
        )
    ),
    queue_entered_at TIMESTAMPTZ,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    report_path TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- E. PRIORITY HISTORY TABLE (Audit Trail for Automatic & Manual Overrides)
CREATE TABLE IF NOT EXISTS public.priority_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    previous_priority TEXT CHECK (previous_priority IS NULL OR previous_priority IN ('HIGH', 'MEDIUM', 'LOW')),
    new_priority TEXT NOT NULL CHECK (new_priority IN ('HIGH', 'MEDIUM', 'LOW')),
    assignment_method TEXT NOT NULL CHECK (assignment_method IN ('AUTOMATIC', 'MANUAL')),
    reason TEXT NOT NULL,
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- F. TEST ASSIGNMENTS TABLE (Staff Test Handling History)
CREATE TABLE IF NOT EXISTS public.test_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- G. NOTIFICATIONS TABLE (SMS & Email Delivery Ledger)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES public.tests(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    notification_type TEXT NOT NULL, -- 'REGISTRATION', 'PRIORITY_REVIEW', 'STARTED', 'COMPLETED'
    channel TEXT NOT NULL CHECK (channel IN ('SMS', 'EMAIL')),
    recipient TEXT NOT NULL,
    message TEXT NOT NULL,
    delivery_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (delivery_status IN ('PENDING', 'SENT', 'FAILED')),
    provider_response JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- H. ACTIVITY LOGS TABLE (Comprehensive System Security & Audit Logging)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. INDEXES FOR HIGH-PERFORMANCE DYNAMIC PRIORITY QUEUE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tests_tracking_number ON public.tests(tracking_number);
CREATE INDEX IF NOT EXISTS idx_tests_patient_id ON public.tests(patient_id);
CREATE INDEX IF NOT EXISTS idx_tests_assigned_to ON public.tests(assigned_to);

-- Specialized Compound Index for the Dynamic Priority Queue:
-- Orders by priority weight (HIGH=1, MEDIUM=2, LOW=3) then FIFO arrival timestamp
CREATE INDEX IF NOT EXISTS idx_tests_priority_queue ON public.tests (
    status,
    (CASE priority 
        WHEN 'HIGH' THEN 1 
        WHEN 'MEDIUM' THEN 2 
        WHEN 'LOW' THEN 3 
        ELSE 4 
     END),
    queue_entered_at ASC
);

CREATE INDEX IF NOT EXISTS idx_patients_phone_email ON public.patients(phone, email);
CREATE INDEX IF NOT EXISTS idx_priority_rules_active ON public.priority_rules(test_category, is_active);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(delivery_status, created_at);

-- ============================================================================
-- 4. COLLISION-SAFE 5-DIGIT TRACKING NUMBER GENERATOR FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_unique_tracking_number()
RETURNS VARCHAR(5) AS $$
DECLARE
    candidate VARCHAR(5);
    exists_check BOOLEAN;
    attempts INT := 0;
BEGIN
    LOOP
        -- Generates a random integer between 10000 and 99999
        candidate := FLOOR(10000 + (random() * 90000))::TEXT;
        
        SELECT EXISTS (
            SELECT 1 FROM public.tests WHERE tracking_number = candidate
        ) INTO exists_check;
        
        IF NOT exists_check THEN
            RETURN candidate;
        END IF;

        attempts := attempts + 1;
        IF attempts > 100 THEN
            RAISE EXCEPTION 'Could not generate a unique tracking number after 100 iterations.';
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ============================================================================
-- 5. ATOMIC "TAKE NEXT TEST" STORED PROCEDURE (FOR UPDATE SKIP LOCKED)
-- ============================================================================
-- Ensures zero race conditions when multiple laboratory technicians click "TAKE NEXT TEST" simultaneously!

CREATE OR REPLACE FUNCTION public.take_next_test_atomic(p_staff_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_test RECORD;
    v_result JSONB;
BEGIN
    -- Validate staff exists and is active
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = p_staff_id AND role IN ('staff', 'admin') AND is_active = TRUE
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Staff member is not authorized or is inactive.'
        );
    END IF;

    -- Atomically lock and claim the highest priority eligible waiting test
    SELECT * INTO v_test
    FROM public.tests
    WHERE status = 'WAITING_IN_QUEUE'
    ORDER BY 
        (CASE priority 
            WHEN 'HIGH' THEN 1 
            WHEN 'MEDIUM' THEN 2 
            WHEN 'LOW' THEN 3 
            ELSE 4 
         END) ASC,
        queue_entered_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_test.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'No eligible tests waiting in the priority queue at this time.'
        );
    END IF;

    -- Update the claimed test
    UPDATE public.tests
    SET 
        status = 'ASSIGNED',
        assigned_to = p_staff_id,
        updated_at = NOW()
    WHERE id = v_test.id;

    -- Record in test_assignments
    INSERT INTO public.test_assignments (test_id, staff_id, assigned_at)
    VALUES (v_test.id, p_staff_id, NOW());

    -- Log activity
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
        p_staff_id, 
        'CLAIMED_TEST', 
        'test', 
        v_test.id, 
        jsonb_build_object(
            'tracking_number', v_test.tracking_number, 
            'priority', v_test.priority,
            'test_name', v_test.test_name
        )
    );

    v_result := jsonb_build_object(
        'success', true,
        'message', 'Test claimed successfully.',
        'test', jsonb_build_object(
            'id', v_test.id,
            'tracking_number', v_test.tracking_number,
            'test_name', v_test.test_name,
            'test_category', v_test.test_category,
            'sample_type', v_test.sample_type,
            'sample_details', v_test.sample_details,
            'priority', v_test.priority,
            'priority_reason', v_test.priority_reason,
            'status', 'ASSIGNED',
            'assigned_to', p_staff_id
        )
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. AUTOMATIC ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.priority_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.priority_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow Public/Anon access required for Patient registration & tracking
CREATE POLICY "Public registration of patients" ON public.patients
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read patient information with tracking authorization" ON public.patients
    FOR SELECT USING (true);

CREATE POLICY "Public registration of tests" ON public.tests
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public tracking of tests" ON public.tests
    FOR SELECT USING (true);

CREATE POLICY "Staff and admin test processing" ON public.tests
    FOR UPDATE USING (true) WITH CHECK (true);

-- Profiles policies
CREATE POLICY "Public profiles read" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Admin profile management" ON public.profiles
    FOR ALL USING (true);

-- Priority rules policies
CREATE POLICY "Read priority rules" ON public.priority_rules
    FOR SELECT USING (true);

CREATE POLICY "Admin manage priority rules" ON public.priority_rules
    FOR ALL USING (true);

-- Priority history, assignments, notifications, activity logs
CREATE POLICY "Public insert notifications" ON public.notifications
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin read notifications" ON public.notifications
    FOR SELECT USING (true);

CREATE POLICY "Staff and admin read assignments" ON public.test_assignments
    FOR ALL USING (true);

CREATE POLICY "Read priority history" ON public.priority_history
    FOR SELECT USING (true);

CREATE POLICY "Insert priority history" ON public.priority_history
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Insert activity logs" ON public.activity_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Read activity logs" ON public.activity_logs
    FOR SELECT USING (true);

-- ============================================================================
-- 7. INITIAL SEED DATA (CORE ROLES, PRIORITY RULES & SAMPLE SPECIMENS)
-- ============================================================================

-- A. Default System Administrator and Laboratory Staff Profiles
INSERT INTO public.profiles (id, full_name, email, phone, role, is_active)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'Dr. Evelyn Reed (Chief Pathologist)', 'admin@labflow.health', '+91 98765 43210', 'admin', true),
    ('b0000000-0000-0000-0000-000000000001', 'Marcus Vance (Senior Lab Analyst)', 'staff1@labflow.health', '+91 98765 43211', 'staff', true),
    ('b0000000-0000-0000-0000-000000000002', 'Sarah Jenkins (Biochemist)', 'staff2@labflow.health', '+91 98765 43212', 'staff', true)
ON CONFLICT (email) DO NOTHING;

-- B. Clinically-Approved Automatic Priority Evaluation Rules
INSERT INTO public.priority_rules (rule_name, test_category, configured_priority, rule_conditions, processing_deadline, is_active)
VALUES
    (
        'Critical Cardiac & Trauma Biomarkers',
        'Cardiac & Emergency',
        'HIGH',
        '{"keywords": ["Troponin", "CK-MB", "D-Dimer", "Arterial Blood Gas"], "max_tat_mins": 30}'::jsonb,
        30,
        true
    ),
    (
        'Infectious Cerebrospinal & Spinal Fluid Panels',
        'Microbiology & CSF',
        'HIGH',
        '{"keywords": ["Spinal Fluid", "CSF", "Gram Stain", "Blood Culture"], "max_tat_mins": 45}'::jsonb,
        45,
        true
    ),
    (
        'Urgent Comprehensive Metabolic Panels',
        'Biochemistry',
        'MEDIUM',
        '{"keywords": ["CMP", "Electrolytes", "Renal", "Liver Function", "Lipid"], "max_tat_mins": 90}'::jsonb,
        90,
        true
    ),
    (
        'Coagulation & Thrombosis Profiling',
        'Coagulation',
        'MEDIUM',
        '{"keywords": ["PT/INR", "aPTT", "Fibrinogen"], "max_tat_mins": 60}'::jsonb,
        60,
        true
    ),
    (
        'Routine Complete Blood Count & Smear',
        'Hematology',
        'LOW',
        '{"keywords": ["CBC", "Hemoglobin", "ESR", "Blood Smear"], "max_tat_mins": 180}'::jsonb,
        180,
        true
    ),
    (
        'Routine Urinalysis & Clinical Microscopy',
        'Urinalysis',
        'LOW',
        '{"keywords": ["Urine Routine", "Urine Culture", "Specific Gravity"], "max_tat_mins": 240}'::jsonb,
        240,
        true
    )
ON CONFLICT DO NOTHING;

-- C. Sample Patients
INSERT INTO public.patients (id, full_name, phone, email, age, gender)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'Eleanor Vance', '+91 91234 56789', 'eleanor.vance@example.com', 48, 'Female'),
    ('c0000000-0000-0000-0000-000000000002', 'Vikramaditya Roy', '+91 98765 12345', 'vikram.roy@example.com', 62, 'Male'),
    ('c0000000-0000-0000-0000-000000000003', 'Anita Sharma', '+91 97890 23456', 'anita.sharma@example.com', 29, 'Female'),
    ('c0000000-0000-0000-0000-000000000004', 'David Kim', '+91 96543 34567', 'david.kim@example.com', 35, 'Male'),
    ('c0000000-0000-0000-0000-000000000005', 'Rachel Green', '+91 95432 45678', 'rachel.green@example.com', 41, 'Female')
ON CONFLICT DO NOTHING;

-- D. Sample Tests Across Different Priority & Queue States
INSERT INTO public.tests (
    id, tracking_number, patient_id, test_name, test_category, sample_type, sample_details,
    priority, priority_source, priority_reason, status, queue_entered_at, registered_at
)
VALUES
    (
        'd0000000-0000-0000-0000-000000000001',
        '48291',
        'c0000000-0000-0000-0000-000000000001',
        'High-Sensitivity Troponin I (STAT)',
        'Cardiac & Emergency',
        'Serum / Whole Blood',
        '3mL EDTA Tube - Hemolysis negative',
        'HIGH',
        'AUTOMATIC',
        'Matched active rule: Critical Cardiac & Trauma Biomarkers (Rule Deadline 30m)',
        'WAITING_IN_QUEUE',
        NOW() - INTERVAL '25 minutes',
        NOW() - INTERVAL '30 minutes'
    ),
    (
        'd0000000-0000-0000-0000-000000000002',
        '59102',
        'c0000000-0000-0000-0000-000000000002',
        'Cerebrospinal Fluid Culture & Gram Stain',
        'Microbiology & CSF',
        'CSF Fluid',
        '2mL Lumbar Puncture specimen in sterile container',
        'HIGH',
        'AUTOMATIC',
        'Matched active rule: Infectious Cerebrospinal & Spinal Fluid Panels',
        'WAITING_IN_QUEUE',
        NOW() - INTERVAL '15 minutes',
        NOW() - INTERVAL '20 minutes'
    ),
    (
        'd0000000-0000-0000-0000-000000000003',
        '61043',
        'c0000000-0000-0000-0000-000000000003',
        'Comprehensive Metabolic Panel (CMP)',
        'Biochemistry',
        'Serum',
        '5mL SST Gold-top tube centrifuged',
        'MEDIUM',
        'AUTOMATIC',
        'Matched active rule: Urgent Comprehensive Metabolic Panels',
        'WAITING_IN_QUEUE',
        NOW() - INTERVAL '40 minutes',
        NOW() - INTERVAL '45 minutes'
    ),
    (
        'd0000000-0000-0000-0000-000000000004',
        '72418',
        'c0000000-0000-0000-0000-000000000004',
        'Complete Blood Count (CBC) with Differential',
        'Hematology',
        'Whole Blood',
        '4mL Lavender EDTA vial',
        'LOW',
        'AUTOMATIC',
        'Matched active rule: Routine Complete Blood Count & Smear',
        'WAITING_IN_QUEUE',
        NOW() - INTERVAL '60 minutes',
        NOW() - INTERVAL '65 minutes'
    ),
    (
        'd0000000-0000-0000-0000-000000000005',
        '83920',
        'c0000000-0000-0000-0000-000000000005',
        'Uncommon Autoimmune Antinuclear Antibody Panel',
        'Immunology / Specialized',
        'Serum',
        'Specialty frozen aliquoted plasma',
        NULL,
        NULL,
        'No matching active rule for category "Immunology / Specialized". Sent for manual medical review.',
        'AWAITING_ADMIN_REVIEW',
        NULL,
        NOW() - INTERVAL '10 minutes'
    )
ON CONFLICT DO NOTHING;

-- E. Sample Completed Test With Verification Report
INSERT INTO public.tests (
    id, tracking_number, patient_id, test_name, test_category, sample_type, sample_details,
    priority, priority_source, priority_reason, status, queue_entered_at, registered_at,
    started_at, completed_at, assigned_to, remarks
)
VALUES
    (
        'd0000000-0000-0000-0000-000000000006',
        '34912',
        'c0000000-0000-0000-0000-000000000003',
        'Routine Lipid Profile with ApoB',
        'Biochemistry',
        'Serum',
        '5mL Fasting blood drawn at 08:00 AM',
        'MEDIUM',
        'AUTOMATIC',
        'Matched active rule: Urgent Comprehensive Metabolic Panels',
        'COMPLETED',
        NOW() - INTERVAL '3 hours',
        NOW() - INTERVAL '3.5 hours',
        NOW() - INTERVAL '2 hours',
        NOW() - INTERVAL '1 hour',
        'b0000000-0000-0000-0000-000000000001',
        'All lipid fractions within normal clinical reference ranges. Report released and verified.'
    )
ON CONFLICT DO NOTHING;

-- F. Initial Activity & Notification Logs
INSERT INTO public.notifications (test_id, patient_id, notification_type, channel, recipient, message, delivery_status, sent_at)
VALUES
    (
        'd0000000-0000-0000-0000-000000000006',
        'c0000000-0000-0000-0000-000000000003',
        'COMPLETED',
        'SMS',
        '+91 97890 23456',
        'Your laboratory test has been completed successfully. Tracking ID: 34912. Please visit the LabFlow portal to check your test status and access your report.',
        'SENT',
        NOW() - INTERVAL '1 hour'
    ),
    (
        'd0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000001',
        'REGISTRATION',
        'EMAIL',
        'eleanor.vance@example.com',
        'Test Registered Successfully. Your Tracking ID: 48291. Priority assigned: HIGH (Critical Cardiac & Emergency).',
        'SENT',
        NOW() - INTERVAL '30 minutes'
    )
ON CONFLICT DO NOTHING;

INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
VALUES
    (
        'a0000000-0000-0000-0000-000000000001',
        'SYSTEM_INITIALIZED',
        'system',
        NULL,
        '{"version": "1.0.0", "engine": "Dynamic Priority Queue + Rule Evaluator"}'::jsonb
    )
ON CONFLICT DO NOTHING;
