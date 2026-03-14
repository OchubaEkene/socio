import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// GET all time records (managers see all, staff see their own)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { staffId, startDate, endDate, isApproved, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const orgId = req.user!.organizationId;
    const where: any = { organizationId: orgId };

    // Staff can only see their own records
    if (req.user!.role === 'staff') {
      const userWithStaff = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { staffId: true }
      });
      if (!userWithStaff?.staffId) {
        return res.json({ success: true, data: { timeRecords: [], pagination: { page: pageNum, limit: limitNum, total: 0, pages: 0 } } });
      }
      where.staffId = userWithStaff.staffId;
    } else {
      if (staffId) where.staffId = staffId;
    }

    if (startDate) where.clockIn = { ...where.clockIn, gte: new Date(startDate as string) };
    if (endDate) where.clockIn = { ...where.clockIn, lte: new Date(endDate as string) };
    if (isApproved !== undefined) where.isApproved = isApproved === 'true';

    const [timeRecords, total] = await Promise.all([
      prisma.timeRecord.findMany({
        where,
        include: {
          staff: { select: { id: true, name: true, staffType: true } },
          shift: { select: { id: true, shiftType: true, date: true } },
          approver: { select: { id: true, firstName: true, lastName: true } }
        },
        skip,
        take: limitNum,
        orderBy: { clockIn: 'desc' }
      }),
      prisma.timeRecord.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        timeRecords,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
      }
    });
  } catch (error) {
    console.error('GET /time-records error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch time records' });
  }
});

// POST create time record (clock in)
router.post('/', [
  body('staffId').isString().notEmpty(),
  body('clockIn').isISO8601(),
  body('clockOut').optional().isISO8601(),
  body('breakMinutes').optional().isInt({ min: 0 }),
  body('notes').optional().isString(),
  body('shiftId').optional().isString()
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });

    const { staffId, clockIn, clockOut, breakMinutes = 0, notes, shiftId } = req.body;

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });

    let totalHours: number | undefined;
    if (clockOut) {
      const diffMs = new Date(clockOut).getTime() - new Date(clockIn).getTime();
      totalHours = Math.max(0, diffMs / 3600000 - breakMinutes / 60);
    }

    const orgId = req.user!.organizationId;
    const timeRecord = await prisma.timeRecord.create({
      data: {
        staffId,
        clockIn: new Date(clockIn),
        ...(clockOut && { clockOut: new Date(clockOut) }),
        ...(totalHours !== undefined && { totalHours }),
        breakMinutes: parseInt(breakMinutes),
        notes,
        ...(shiftId && { shiftId }),
        organizationId: orgId,
      },
      include: {
        staff: { select: { id: true, name: true, staffType: true } },
        shift: { select: { id: true, shiftType: true, date: true } }
      }
    });

    res.status(201).json({ success: true, message: 'Time record created', data: { timeRecord } });
  } catch (error) {
    console.error('POST /time-records error:', error);
    res.status(500).json({ success: false, message: 'Failed to create time record' });
  }
});

// PATCH update time record (clock out / edit / approve)
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { clockOut, breakMinutes, notes, isApproved } = req.body;

    const existing = await prisma.timeRecord.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Time record not found' });

    // Only managers/admins can approve; staff can only edit their own
    if (isApproved !== undefined && req.user!.role === 'staff') {
      return res.status(403).json({ success: false, message: 'Only managers can approve time records' });
    }

    const updateData: any = {};
    if (clockOut !== undefined) updateData.clockOut = new Date(clockOut);
    if (breakMinutes !== undefined) updateData.breakMinutes = parseInt(breakMinutes);
    if (notes !== undefined) updateData.notes = notes;
    if (isApproved !== undefined) {
      updateData.isApproved = isApproved;
      if (isApproved) {
        updateData.approvedBy = req.user!.id;
        updateData.approvedAt = new Date();
      }
    }

    // Recalculate totalHours if clockOut updated
    const finalClockOut = updateData.clockOut || existing.clockOut;
    const finalBreak = updateData.breakMinutes !== undefined ? updateData.breakMinutes : existing.breakMinutes;
    if (finalClockOut) {
      const diffMs = finalClockOut.getTime() - existing.clockIn.getTime();
      updateData.totalHours = Math.max(0, diffMs / 3600000 - finalBreak / 60);
    }

    const timeRecord = await prisma.timeRecord.update({
      where: { id },
      data: updateData,
      include: {
        staff: { select: { id: true, name: true } },
        approver: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    res.json({ success: true, message: 'Time record updated', data: { timeRecord } });
  } catch (error) {
    console.error('PATCH /time-records/:id error:', error);
    res.status(500).json({ success: false, message: 'Failed to update time record' });
  }
});

// DELETE time record (managers only)
router.delete('/:id', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.timeRecord.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Time record not found' });

    await prisma.timeRecord.delete({ where: { id } });
    res.json({ success: true, message: 'Time record deleted' });
  } catch (error) {
    console.error('DELETE /time-records/:id error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete time record' });
  }
});

export default router;
