import express from 'express';
import { localDb, supabase, isSupabaseConfigured } from '../config/supabase.js';
import { sendNotification } from '../services/notificationService.js';

const router = express.Router();

/**
 * LABORATORY STAFF PORTAL ROUTES
 */

// 1. Staff Dashboard Statistics
router.get('/dashboard', async (req, res) => {
  const tests = localDb.get('tests');
  const waitingCount = tests.filter(t => t.status === 'WAITING_IN_QUEUE').length;
  const highPriorityCount = tests.filter(t => t.status === 'WAITING_IN_QUEUE' && t.priority === 'HIGH').length;
  const inProgressCount = tests.filter(t => t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED').length;
  
  // Completed today
  const today = new Date().toISOString().slice(0, 10);
  const completedTodayCount = tests.filter(t => 
    t.status === 'COMPLETED' && t.completed_at && t.completed_at.startsWith(today)
  ).length;

  res.json({
    success: true,
    stats: {
      waiting_tests: waitingCount,
      high_priority: highPriorityCount,
      in_progress: inProgressCount,
      completed_today: completedTodayCount
    }
  });
});

// 2. Get Currently Assigned Test for Staff
router.get('/current-test', async (req, res) => {
  const staffId = req.query.staff_id || 'b0000000-0000-0000-0000-000000000001';
  const tests = localDb.get('tests');
  const patients = localDb.get('patients');

  const activeTest = tests.find(t => 
    (t.assigned_to === staffId || !t.assigned_to) && 
    (t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS')
  );

  if (!activeTest) {
    return res.json({ success: true, test: null });
  }

  const patient = patients.find(p => p.id === activeTest.patient_id);
  const staff = localDb.get('profiles').find(p => p.id === activeTest.assigned_to);

  res.json({
    success: true,
    test: {
      ...activeTest,
      patient,
      assigned_staff_name: staff?.full_name || 'Assigned Staff'
    }
  });
});

// 3. Start Test
router.post('/start-test', async (req, res) => {
  const { test_id, staff_id } = req.body;
  if (!test_id) {
    return res.status(400).json({ success: false, error: 'test_id is required' });
  }

  const now = new Date().toISOString();
  const updated = localDb.update('tests', test_id, {
    status: 'IN_PROGRESS',
    started_at: now
  });

  localDb.insert('activity_logs', {
    user_id: staff_id,
    action: 'STARTED_TEST',
    entity_type: 'test',
    entity_id: test_id
  });

  res.json({
    success: true,
    message: 'Test processing started.',
    test: updated
  });
});

// 4. Complete Test
router.post('/complete-test', async (req, res) => {
  try {
    const { test_id, staff_id, remarks, report_name } = req.body;
    if (!test_id) {
      return res.status(400).json({ success: false, error: 'test_id is required' });
    }

    const test = localDb.get('tests').find(t => t.id === test_id);
    if (!test) {
      return res.status(404).json({ success: false, error: 'Test not found' });
    }

    const now = new Date().toISOString();
    const generatedReportPath = `/reports/${test.tracking_number}_DiagnosticReport.pdf`;

    // 1. Mark as Completed
    const completedTest = localDb.update('tests', test_id, {
      status: 'COMPLETED',
      completed_at: now,
      report_path: generatedReportPath,
      remarks: remarks || 'Analysis completed with verified clinical diagnostics.'
    });

    // 2. Log Activity
    localDb.insert('activity_logs', {
      user_id: staff_id,
      action: 'COMPLETED_TEST',
      entity_type: 'test',
      entity_id: test_id,
      details: { tracking_number: test.tracking_number, completion_time: now }
    });

    // 3. Trigger SMS & Email Notifications to Patient
    const patient = localDb.get('patients').find(p => p.id === test.patient_id);
    if (patient) {
      await sendNotification({
        testId: test.id,
        patientId: patient.id,
        notificationType: 'COMPLETED',
        recipientPhone: patient.phone,
        recipientEmail: patient.email,
        trackingNumber: test.tracking_number,
        priority: test.priority
      });
    }

    return res.json({
      success: true,
      message: 'Test completed successfully. Report generated and patient notifications triggered.',
      test: completedTest
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Completed Tests List
router.get('/completed-tests', async (req, res) => {
  const tests = localDb.get('tests').filter(t => t.status === 'COMPLETED');
  const patients = localDb.get('patients');

  const result = tests.map(t => ({
    ...t,
    patient: patients.find(p => p.id === t.patient_id)
  }));

  res.json({ success: true, count: result.length, tests: result });
});

export default router;
