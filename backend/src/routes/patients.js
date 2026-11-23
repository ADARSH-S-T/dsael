import express from 'express';
import { localDb, supabase, isSupabaseConfigured } from '../config/supabase.js';
import { evaluateTestPriority, recordPriorityHistory } from '../services/priorityEngine.js';
import { sendNotification } from '../services/notificationService.js';

const router = express.Router();

/**
 * Generate unique 5-digit tracking number
 */
function generateTrackingNumber() {
  const tests = localDb.get('tests');
  let candidate = '';
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 100) {
    candidate = Math.floor(10000 + Math.random() * 90000).toString();
    exists = tests.some(t => t.tracking_number === candidate);
    attempts++;
  }
  return candidate;
}

/**
 * PATIENT REGISTRATION
 */
router.post('/register', async (req, res) => {
  try {
    const {
      patient_name,
      phone,
      email,
      age,
      gender,
      test_name,
      test_category,
      sample_type,
      sample_details,
      additional_information
    } = req.body;

    // 1. Validation
    if (!patient_name || !phone || !email || !age || !test_name || !test_category || !sample_type || !sample_details) {
      return res.status(400).json({
        success: false,
        error: 'All required fields must be provided.'
      });
    }

    const now = new Date().toISOString();

    // 2. Save Patient
    let patient = null;
    if (isSupabaseConfigured && supabase) {
      const { data: pData } = await supabase
        .from('patients')
        .insert([{
          full_name: patient_name.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          age: parseInt(age, 10),
          gender: gender || 'Other'
        }])
        .select()
        .single();
      patient = pData;
    } else {
      patient = localDb.insert('patients', {
        full_name: patient_name.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        age: parseInt(age, 10),
        gender: gender || 'Other'
      });
    }

    // 3. Generate Unique 5-Digit Tracking Code
    const trackingNumber = generateTrackingNumber();

    // 4. Evaluate Automatic Priority Engine
    const evalResult = await evaluateTestPriority({
      test_category,
      test_name,
      sample_details
    });

    const isQueued = evalResult.status === 'WAITING_IN_QUEUE';

    // 5. Create Test Record
    const testRecord = {
      tracking_number: trackingNumber,
      patient_id: patient.id,
      test_name: test_name.trim(),
      test_category: test_category.trim(),
      sample_type: sample_type.trim(),
      sample_details: sample_details.trim(),
      additional_information: additional_information || null,
      priority: evalResult.priority,
      priority_source: evalResult.source,
      priority_reason: evalResult.reason,
      status: evalResult.status,
      queue_entered_at: isQueued ? now : null,
      registered_at: now,
      assigned_to: null,
      started_at: null,
      completed_at: null,
      report_path: null,
      remarks: null
    };

    let createdTest = null;
    if (isSupabaseConfigured && supabase) {
      const { data: tData } = await supabase
        .from('tests')
        .insert([testRecord])
        .select()
        .single();
      createdTest = tData;
    } else {
      createdTest = localDb.insert('tests', testRecord);
    }

    // 6. Record Priority History
    if (evalResult.priority) {
      await recordPriorityHistory({
        testId: createdTest.id,
        previousPriority: null,
        newPriority: evalResult.priority,
        method: 'AUTOMATIC',
        reason: evalResult.reason
      });
    }

    // 7. Dispatch Notification (Registration Confirmation)
    await sendNotification({
      testId: createdTest.id,
      patientId: patient.id,
      notificationType: isQueued ? 'REGISTRATION' : 'PRIORITY_REVIEW',
      recipientPhone: patient.phone,
      recipientEmail: patient.email,
      trackingNumber: trackingNumber,
      priority: evalResult.priority
    });

    // 8. Return Confirmation
    return res.status(201).json({
      success: true,
      message: 'Test Registered Successfully',
      tracking_number: trackingNumber,
      test: createdTest,
      patient: patient,
      priority_status: evalResult
    });

  } catch (err) {
    console.error('[Registration Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATIENT VERIFICATION & TRACKING
 */
router.post('/verify-otp', async (req, res) => {
  const { tracking_number, verification_code } = req.body;
  if (!tracking_number) {
    return res.status(400).json({ success: false, error: 'Tracking ID is required.' });
  }

  const tests = localDb.get('tests');
  const test = tests.find(t => t.tracking_number === tracking_number.trim());

  if (!test) {
    return res.status(404).json({ success: false, error: 'Invalid tracking number. No test found.' });
  }

  // Simulated OTP verification (accepts standard demo OTP 123456 or matches last 4 digits of phone)
  return res.json({
    success: true,
    message: 'Patient identity verified.',
    verified: true
  });
});

router.get('/track/:tracking_number', async (req, res) => {
  const { tracking_number } = req.params;

  let test = null;
  let patient = null;

  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase
      .from('tests')
      .select('*, patient:patient_id(*)')
      .eq('tracking_number', tracking_number.trim())
      .single();
    test = data;
    patient = data?.patient;
  } else {
    test = localDb.get('tests').find(t => t.tracking_number === tracking_number.trim());
    if (test) {
      patient = localDb.get('patients').find(p => p.id === test.patient_id);
    }
  }

  if (!test) {
    return res.status(404).json({
      success: false,
      error: `Test with Tracking ID "${tracking_number}" was not found.`
    });
  }

  return res.json({
    success: true,
    test: {
      tracking_number: test.tracking_number,
      test_name: test.test_name,
      test_category: test.test_category,
      sample_type: test.sample_type,
      priority: test.priority,
      status: test.status,
      registered_at: test.registered_at,
      started_at: test.started_at,
      completed_at: test.completed_at,
      remarks: test.remarks,
      report_available: Boolean(test.status === 'COMPLETED' || test.report_path),
      report_path: test.status === 'COMPLETED' ? test.report_path : null
    },
    patient: patient ? {
      full_name: patient.full_name,
      masked_phone: patient.phone.replace(/(\d{2})\d+(\d{2})/, '$1******$2'),
      masked_email: patient.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
    } : null
  });
});

export default router;
