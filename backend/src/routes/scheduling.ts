import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { generateSchedule, getWeekSchedule } from '../services/schedulingService';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { startOfWeek, parseISO, subWeeks } from 'date-fns';

const router = Router();

// POST generate schedule — managers and admins only
router.post('/generate', [
  authenticateToken,
  requireRole('admin', 'manager'),
  body('weekStart').isISO8601().withMessage('Week start must be a valid ISO 8601 date')
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { weekStart } = req.body;

    // Prevent accidental overwrite of schedules more than 4 weeks in the past
    const weekStartDate = startOfWeek(parseISO(weekStart), { weekStartsOn: 1 });
    const cutoff = subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 4);
    if (weekStartDate < cutoff) {
      return res.status(400).json({ success: false, message: 'Cannot generate a schedule more than 4 weeks in the past.' });
    }

    const result = await generateSchedule(weekStart);

    res.json({ success: true, message: 'Schedule generated successfully', data: result });
  } catch (error: any) {
    console.error('POST /scheduling/generate error:', error);
    if (error?.message?.startsWith('NO_RULES:')) {
      return res.status(400).json({ success: false, message: error.message.replace('NO_RULES: ', '') });
    }
    res.status(500).json({ success: false, message: 'Failed to generate schedule' });
  }
});

// GET schedule for a specific week — read only, no generation
router.get('/week/:weekStart', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { weekStart } = req.params;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const result = await getWeekSchedule(weekStart);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('GET /scheduling/week/:weekStart error:', error);
    res.status(500).json({ success: false, message: 'Failed to get schedule' });
  }
});

// GET current week schedule — read only
router.get('/current-week', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const result = await getWeekSchedule(weekStart);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('GET /scheduling/current-week error:', error);
    res.status(500).json({ success: false, message: 'Failed to get current week schedule' });
  }
});

export default router;
