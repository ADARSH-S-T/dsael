import express from 'express';
import { getPriorityQueue, claimNextTest } from '../services/queueService.js';

const router = express.Router();

/**
 * DYNAMIC PRIORITY QUEUE ENDPOINTS
 */

// 1. Get Live Sorted Priority Queue
router.get('/', async (req, res) => {
  try {
    const queue = await getPriorityQueue();
    return res.json({
      success: true,
      count: queue.length,
      queue: queue
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Atomic "TAKE NEXT TEST" Action
router.post('/take-next', async (req, res) => {
  try {
    const { staff_id } = req.body;
    // Fallback to default staff ID if not specified
    const staffId = staff_id || 'b0000000-0000-0000-0000-000000000001';

    const result = await claimNextTest(staffId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
