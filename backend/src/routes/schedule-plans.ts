import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { generateSchedule } from '../services/schedulingService';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';

const router = Router();

router.use(authenticateToken, requireRole('admin', 'manager'));

// GET all schedule plans
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const plans = await prisma.schedulePlan.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: plans });
  } catch (error) {
    console.error('GET /schedule-plans error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch schedule plans' });
  }
});

// GET single plan + its shifts + exceptions
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const plan = await prisma.schedulePlan.findUnique({ where: { id: req.params.id } });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    const shifts = await prisma.shift.findMany({
      where: { date: { gte: plan.weekStart, lte: plan.weekEnd } },
      include: { staff: { select: { id: true, name: true, staffType: true, gender: true } } },
      orderBy: [{ date: 'asc' }, { shiftType: 'asc' }],
    });

    // Unique staff in this plan
    const staffIds = [...new Set(shifts.map(s => s.staffId))];
    const staffList = await prisma.staff.findMany({
      where: { id: { in: staffIds }, isActive: true },
      select: { id: true, name: true, email: true, staffType: true },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: { plan, shifts, staffList } });
  } catch (error) {
    console.error('GET /schedule-plans/:id error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch schedule plan' });
  }
});

// POST create a named schedule plan with arbitrary date range
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, startDate, endDate } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'name, startDate and endDate are required' });
    }

    const start = parseISO(startDate);
    const end = parseISO(endDate);

    if (end < start) {
      return res.status(400).json({ success: false, message: 'endDate must be after startDate' });
    }

    // Collect all Mondays (week starts) in the range
    const weeks: Date[] = [];
    let cur = startOfWeek(start, { weekStartsOn: 1 });
    while (cur <= end) {
      weeks.push(cur);
      cur = addDays(cur, 7);
    }

    // Generate shifts week by week (sequential — each week deletes+writes DB, can't parallelise)
    let totalShifts = 0;
    const allExceptions: any[] = [];
    for (const weekDate of weeks) {
      const result = await generateSchedule(weekDate);
      totalShifts += result.summary.totalShifts;
      allExceptions.push(...result.exceptions);
    }

    // Delete existing plan for the same date range if any
    await prisma.schedulePlan.deleteMany({
      where: { weekStart: startOfWeek(start, { weekStartsOn: 1 }), weekEnd: addDays(startOfWeek(end, { weekStartsOn: 1 }), 6) },
    });

    const plan = await prisma.schedulePlan.create({
      data: {
        name,
        weekStart: startOfWeek(start, { weekStartsOn: 1 }),
        weekEnd: addDays(startOfWeek(end, { weekStartsOn: 1 }), 6),
        totalShifts,
        exceptionsData: allExceptions as any,
        status: 'draft',
      },
    });

    res.json({ success: true, data: { plan, totalShifts, totalExceptions: allExceptions.length } });
  } catch (error) {
    console.error('POST /schedule-plans error:', error);
    res.status(500).json({ success: false, message: 'Failed to create schedule plan' });
  }
});

// POST send emails — accepts optional staffIds (empty = all)
router.post('/:id/send-emails', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { staffIds }: { staffIds?: string[] } = req.body;

    const plan = await prisma.schedulePlan.findUnique({ where: { id } });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    const shifts = await prisma.shift.findMany({
      where: { date: { gte: plan.weekStart, lte: plan.weekEnd } },
      include: { staff: { select: { id: true, name: true, email: true } } },
      orderBy: { date: 'asc' },
    });

    // Group by staff
    const staffShifts = new Map<string, { name: string; email: string; shifts: typeof shifts }>();
    for (const shift of shifts) {
      if (staffIds?.length && !staffIds.includes(shift.staffId)) continue;
      if (!staffShifts.has(shift.staffId)) {
        staffShifts.set(shift.staffId, { name: shift.staff.name, email: shift.staff.email || '', shifts: [] });
      }
      staffShifts.get(shift.staffId)!.shifts.push(shift);
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const weekStr = format(plan.weekStart, 'yyyy-MM-dd');
    let sent = 0;

    for (const [, { name, email, shifts: staffShiftList }] of staffShifts) {
      if (!email) continue;

      const shiftRows = staffShiftList.map(s =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">${format(s.date, 'EEE, MMM d')}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-transform:capitalize">${s.shiftType} shift</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">${format(s.startTime, 'HH:mm')} – ${format(s.endTime, 'HH:mm')}</td>
        </tr>`
      ).join('');

      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1d4ed8">${plan.name}</h2>
          <p>Hi ${name},</p>
          <p>Your shifts for <strong>${format(plan.weekStart, 'MMM d')} – ${format(plan.weekEnd, 'MMM d, yyyy')}</strong>:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <thead><tr style="background:#f3f4f6">
              <th style="padding:8px 12px;text-align:left">Day</th>
              <th style="padding:8px 12px;text-align:left">Type</th>
              <th style="padding:8px 12px;text-align:left">Hours</th>
            </tr></thead>
            <tbody>${shiftRows}</tbody>
          </table>
          <p><a href="${appUrl}/my-schedule?week=${weekStr}"
            style="display:inline-block;padding:10px 20px;background:#1d4ed8;color:#fff;border-radius:6px;text-decoration:none">
            View My Schedule
          </a></p>
          <p style="color:#6b7280;font-size:13px">Contact your manager if you need changes.</p>
        </div>
      `;

      try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.default.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: false,
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@socio.app',
          to: email,
          subject: `Your Schedule – ${plan.name}`,
          html,
        });
        sent++;
      } catch (err) {
        console.error(`Email failed for ${name}:`, err);
      }
    }

    await prisma.schedulePlan.update({
      where: { id },
      data: { status: 'published', emailsSent: true },
    });

    res.json({ success: true, data: { sent, total: staffShifts.size } });
  } catch (error) {
    console.error('POST /schedule-plans/:id/send-emails error:', error);
    res.status(500).json({ success: false, message: 'Failed to send emails' });
  }
});

// DELETE a plan
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.schedulePlan.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /schedule-plans/:id error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete plan' });
  }
});

export default router;
