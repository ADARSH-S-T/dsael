import express from 'express';
import { localDb, supabase, isSupabaseConfigured } from '../config/supabase.js';
import { recordPriorityHistory } from '../services/priorityEngine.js';

const router = express.Router();

/**
 * ADMIN DASHBOARD ROUTES
 */

// 1. Dashboard Statistics
router.get('/stats', async (req, res) => {
  const tests = localDb.get('tests');
  const total = tests.length;
  const waiting = tests.filter(t => t.status === 'WAITING_IN_QUEUE').length;
  const completed = tests.filter(t => t.status === 'COMPLETED').length;
  const awaitingReview = tests.filter(t => t.status === 'AWAITING_ADMIN_REVIEW').length;
  const inProgress = tests.filter(t => t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED').length;

  res.json({
    success: true,
    stats: {
      total_tests: total,
      waiting_tests: waiting,
      completed_tests: completed,
      awaiting_review: awaitingReview,
      in_progress: inProgress
    }
  });
});

// 2. All Tests with Filtering
router.get('/tests', async (req, res) => {
  const { priority, status, category, search } = req.query;
  let tests = localDb.get('tests');
  const patients = localDb.get('patients');
  const staff = localDb.get('profiles');

  if (priority && priority !== 'ALL') {
    tests = tests.filter(t => t.priority === priority);
  }
  if (status && status !== 'ALL') {
    tests = tests.filter(t => t.status === status);
  }
  if (category && category !== 'ALL') {
    tests = tests.filter(t => t.test_category === category);
  }
  if (search) {
    const q = search.toLowerCase();
    tests = tests.filter(t => 
      t.tracking_number.includes(q) ||
      t.test_name.toLowerCase().includes(q)
    );
  }

  const enriched = tests.map(t => {
    const patient = patients.find(p => p.id === t.patient_id);
    const assignedStaff = staff.find(s => s.id === t.assigned_to);
    return {
      ...t,
      patient,
      assigned_staff_name: assignedStaff?.full_name || null
    };
  });

  // Sort newest first
  enriched.sort((a, b) => new Date(b.registered_at) - new Date(a.registered_at));

  res.json({ success: true, count: enriched.length, tests: enriched });
});

// 3. Priority Review List (Tests requiring Admin Manual Priority Assignment)
router.get('/priority-review', async (req, res) => {
  const tests = localDb.get('tests').filter(t => t.status === 'AWAITING_ADMIN_REVIEW');
  const patients = localDb.get('patients');

  const enriched = tests.map(t => ({
    ...t,
    patient: patients.find(p => p.id === t.patient_id)
  }));

  res.json({ success: true, count: enriched.length, tests: enriched });
});

// 4. Submit Priority Review Decision (STEP 5 & 6)
router.post('/priority-review/:id', async (req, res) => {
  const { id } = req.params;
  const { priority, reason, admin_id } = req.body;

  if (!priority || !['HIGH', 'MEDIUM', 'LOW'].includes(priority)) {
    return res.status(400).json({ success: false, error: 'Priority must be HIGH, MEDIUM, or LOW.' });
  }

  if (!reason || !reason.trim()) {
    return res.status(400).json({ success: false, error: 'A justification reason is required for manual assignment.' });
  }

  const test = localDb.get('tests').find(t => t.id === id);
  if (!test) {
    return res.status(404).json({ success: false, error: 'Test not found' });
  }

  const now = new Date().toISOString();

  // Move test into the correct priority queue
  const updated = localDb.update('tests', id, {
    priority: priority,
    priority_source: 'MANUAL',
    priority_reason: `Admin Assigned: ${reason.trim()}`,
    status: 'WAITING_IN_QUEUE',
    queue_entered_at: now
  });

  // Record priority audit history
  await recordPriorityHistory({
    testId: id,
    previousPriority: test.priority,
    newPriority: priority,
    method: 'MANUAL',
    reason: reason.trim(),
    changedBy: admin_id
  });

  // Log activity
  localDb.insert('activity_logs', {
    user_id: admin_id,
    action: 'ADMIN_ASSIGNED_PRIORITY',
    entity_type: 'test',
    entity_id: id,
    details: { tracking_number: test.tracking_number, priority, reason }
  });

  res.json({
    success: true,
    message: `Test ${test.tracking_number} assigned priority ${priority} and moved into waiting queue.`,
    test: updated
  });
});

// 5. Override Existing Priority
router.post('/priority-override/:id', async (req, res) => {
  const { id } = req.params;
  const { priority, reason, admin_id } = req.body;

  if (!priority || !['HIGH', 'MEDIUM', 'LOW'].includes(priority)) {
    return res.status(400).json({ success: false, error: 'Invalid priority level' });
  }

  if (!reason) {
    return res.status(400).json({ success: false, error: 'Reason is required for priority override' });
  }

  const test = localDb.get('tests').find(t => t.id === id);
  if (!test) return res.status(404).json({ success: false, error: 'Test not found' });

  const prev = test.priority;
  const updated = localDb.update('tests', id, {
    priority: priority,
    priority_source: 'MANUAL',
    priority_reason: `Admin Override: ${reason}`
  });

  await recordPriorityHistory({
    testId: id,
    previousPriority: prev,
    newPriority: priority,
    method: 'MANUAL',
    reason,
    changedBy: admin_id
  });

  res.json({ success: true, message: 'Priority overridden successfully', test: updated });
});

// 6. Priority Rules CRUD
router.get('/rules', async (req, res) => {
  const rules = localDb.get('priority_rules');
  res.json({ success: true, count: rules.length, rules });
});

router.post('/rules', async (req, res) => {
  const { rule_name, test_category, configured_priority, processing_deadline, keywords } = req.body;
  if (!rule_name || !test_category || !configured_priority) {
    return res.status(400).json({ success: false, error: 'Missing required rule parameters' });
  }

  const newRule = localDb.insert('priority_rules', {
    rule_name: rule_name.trim(),
    test_category: test_category.trim(),
    configured_priority,
    processing_deadline: parseInt(processing_deadline || 60, 10),
    rule_conditions: { keywords: Array.isArray(keywords) ? keywords : [keywords].filter(Boolean) },
    is_active: true
  });

  res.status(201).json({ success: true, message: 'Rule created successfully', rule: newRule });
});

router.put('/rules/:id', async (req, res) => {
  const { id } = req.params;
  const updated = localDb.update('priority_rules', id, req.body);
  res.json({ success: true, message: 'Rule updated', rule: updated });
});

router.delete('/rules/:id', async (req, res) => {
  const { id } = req.params;
  localDb.delete('priority_rules', id);
  res.json({ success: true, message: 'Rule deleted' });
});

// 7. Staff Management
router.get('/staff', async (req, res) => {
  const staff = localDb.get('profiles').filter(p => p.role === 'staff');
  const tests = localDb.get('tests');

  const enrichedStaff = staff.map(s => {
    const assignedTests = tests.filter(t => t.assigned_to === s.id && (t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS')).length;
    const completedTests = tests.filter(t => t.assigned_to === s.id && t.status === 'COMPLETED').length;
    return {
      ...s,
      active_workload: assignedTests,
      total_completed: completedTests
    };
  });

  res.json({ success: true, staff: enrichedStaff });
});

router.post('/staff', async (req, res) => {
  const { full_name, email, phone } = req.body;
  if (!full_name || !email) {
    return res.status(400).json({ success: false, error: 'Full name and email required' });
  }

  const newStaff = localDb.insert('profiles', {
    full_name: full_name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone || '+91 98765 00000',
    role: 'staff',
    is_active: true
  });

  res.status(201).json({ success: true, message: 'Staff member added successfully', staff: newStaff });
});

router.patch('/staff/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const member = localDb.get('profiles').find(p => p.id === id);
  if (!member) return res.status(404).json({ success: false, error: 'Staff member not found' });

  const updated = localDb.update('profiles', id, { is_active: !member.is_active });
  res.json({ success: true, message: `Staff member ${updated.is_active ? 'activated' : 'deactivated'}`, staff: updated });
});

// 8. Notification History & Activity Logs
router.get('/notifications', async (req, res) => {
  const notifications = localDb.get('notifications');
  notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ success: true, count: notifications.length, notifications });
});

router.get('/activity-logs', async (req, res) => {
  const logs = localDb.get('activity_logs');
  logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ success: true, count: logs.length, logs });
});

export default router;
