import { localDb, supabase, isSupabaseConfigured } from '../config/supabase.js';

const PRIORITY_WEIGHTS = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3
};

/**
 * Calculates human-readable waiting time from queue_entered_at
 */
export function calculateWaitingTime(queueEnteredAt) {
  if (!queueEnteredAt) return '0m';
  const diffMs = Math.max(0, Date.now() - new Date(queueEnteredAt).getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

/**
 * Retrieves the live Dynamic Priority Queue
 * Correct processing order: HIGH -> MEDIUM -> LOW, with FIFO on queue_entered_at
 */
export async function getPriorityQueue() {
  let waitingTests = [];

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('tests')
      .select('*, patient:patient_id(full_name, phone, email, age, gender)')
      .eq('status', 'WAITING_IN_QUEUE');

    if (!error && data) {
      waitingTests = data;
    }
  } else {
    const tests = localDb.get('tests').filter(t => t.status === 'WAITING_IN_QUEUE');
    const patients = localDb.get('patients');
    waitingTests = tests.map(t => {
      const patient = patients.find(p => p.id === t.patient_id);
      return { ...t, patient };
    });
  }

  // Sort by priority weight (1, 2, 3), then FIFO by queue_entered_at
  waitingTests.sort((a, b) => {
    const weightA = PRIORITY_WEIGHTS[a.priority] || 99;
    const weightB = PRIORITY_WEIGHTS[b.priority] || 99;
    if (weightA !== weightB) {
      return weightA - weightB;
    }
    const timeA = new Date(a.queue_entered_at || a.registered_at || 0).getTime();
    const timeB = new Date(b.queue_entered_at || b.registered_at || 0).getTime();
    return timeA - timeB;
  });

  // Assign queue position and waiting duration
  return waitingTests.map((t, idx) => ({
    ...t,
    queue_position: idx + 1,
    waiting_time: calculateWaitingTime(t.queue_entered_at)
  }));
}

/**
 * Atomically claims the next highest-priority waiting test for a staff member.
 * Safe against concurrent access from multiple staff members!
 */
export async function claimNextTest(staffId) {
  if (isSupabaseConfigured && supabase) {
    // Call PostgreSQL atomic stored procedure
    const { data, error } = await supabase.rpc('take_next_test_atomic', {
      p_staff_id: staffId
    });

    if (error) {
      console.error('[Queue Claim Error]:', error);
      throw new Error(error.message);
    }
    return data;
  }

  // Local resilient atomic lock simulation
  const queue = await getPriorityQueue();
  if (queue.length === 0) {
    return {
      success: false,
      message: 'No eligible tests waiting in the priority queue at this time.'
    };
  }

  const highestPriorityTest = queue[0];
  const now = new Date().toISOString();

  // Atomically update test
  const updatedTest = localDb.update('tests', highestPriorityTest.id, {
    status: 'ASSIGNED',
    assigned_to: staffId,
    updated_at: now
  });

  // Record assignment
  localDb.insert('test_assignments', {
    test_id: highestPriorityTest.id,
    staff_id: staffId,
    assigned_at: now
  });

  // Log activity
  localDb.insert('activity_logs', {
    user_id: staffId,
    action: 'CLAIMED_TEST',
    entity_type: 'test',
    entity_id: highestPriorityTest.id,
    details: {
      tracking_number: highestPriorityTest.tracking_number,
      priority: highestPriorityTest.priority,
      test_name: highestPriorityTest.test_name
    }
  });

  return {
    success: true,
    message: 'Test claimed successfully.',
    test: updatedTest
  };
}
