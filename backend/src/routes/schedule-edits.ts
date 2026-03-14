import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// All schedule edit routes require auth + manager/admin
router.use(authenticateToken, requireRole('admin', 'manager'));

// POST assign staff to shift
router.post('/assign', [
  body('staffId').isString().notEmpty(),
  body('date').isISO8601(),
  body('shiftType').isIn(['day', 'night'])
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { staffId, shiftId, date, shiftType } = req.body;
    const orgId = req.user!.organizationId;

    const staff = await prisma.staff.findFirst({ where: { id: staffId, organizationId: orgId } });
    if (!staff) return res.status(404).json({ message: 'Staff member not found' });

    if (shiftId && shiftId !== 'new') {
      const existing = await prisma.shift.findUnique({ where: { id: shiftId } });
      if (!existing) return res.status(404).json({ message: 'Shift not found' });
    }

    const existingAssignment = await prisma.shift.findFirst({ where: { staffId, date: new Date(date), shiftType, organizationId: orgId } });
    if (existingAssignment) return res.status(400).json({ message: 'Staff member is already assigned to this shift' });

    const conflictingShift = await prisma.shift.findFirst({
      where: { staffId, date: new Date(date), shiftType: shiftType === 'day' ? 'night' : 'day', organizationId: orgId }
    });
    if (conflictingShift) return res.status(400).json({ message: 'Staff member is already assigned to a conflicting shift on this day' });

    // Check approved absences
    const absence = await prisma.absence.findFirst({
      where: { staffId, organizationId: orgId, status: 'APPROVED', startDate: { lte: new Date(date) }, endDate: { gte: new Date(date) } }
    });
    if (absence) return res.status(400).json({ message: `${staff.name} has an approved absence on this date (${absence.absenceType})` });

    if (staff.staffType === 'temporary') {
      const availability = await prisma.availability.findFirst({
        where: { staffId, staff: { organizationId: orgId }, startTime: { lte: new Date(date) }, endTime: { gte: new Date(date) } }
      });
      if (!availability) return res.status(400).json({ message: 'Temporary staff member is not available for this date' });
    }

    const dateMs = new Date(date).getTime();
    const newShift = await prisma.shift.create({
      data: {
        staffId, shiftType, date: new Date(date),
        startTime: shiftType === 'day' ? new Date(new Date(dateMs).setHours(8, 0, 0, 0)) : new Date(new Date(dateMs).setHours(20, 0, 0, 0)),
        endTime: shiftType === 'day' ? new Date(new Date(dateMs).setHours(20, 0, 0, 0)) : new Date(new Date(dateMs + 86400000).setHours(8, 0, 0, 0)),
        organizationId: orgId,
      },
      include: { staff: { select: { id: true, name: true, gender: true, staffType: true } } }
    });

    res.status(201).json({ message: 'Staff member assigned successfully', shift: newShift });
  } catch (error) {
    console.error('Assign staff error:', error);
    res.status(500).json({ message: 'Failed to assign staff member' });
  }
});

// DELETE remove staff from shift
router.delete('/remove/:shiftId', async (req: AuthRequest, res: Response) => {
  try {
    const { shiftId } = req.params;
    const orgId = req.user!.organizationId;
    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, organizationId: orgId },
      include: { staff: { select: { id: true, name: true } } }
    });
    if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });

    await prisma.shift.delete({ where: { id: shiftId } });
    res.json({ message: 'Staff member removed from shift successfully', removedShift: shift });
  } catch (error) {
    console.error('Remove staff error:', error);
    res.status(500).json({ message: 'Failed to remove staff member' });
  }
});

// POST swap two staff members
router.post('/swap', [
  body('shift1Id').isString().notEmpty(),
  body('shift2Id').isString().notEmpty()
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { shift1Id, shift2Id } = req.body;
    const orgId = req.user!.organizationId;

    const [shift1, shift2] = await Promise.all([
      prisma.shift.findFirst({ where: { id: shift1Id, organizationId: orgId }, include: { staff: true } }),
      prisma.shift.findFirst({ where: { id: shift2Id, organizationId: orgId }, include: { staff: true } })
    ]);

    if (!shift1 || !shift2) return res.status(404).json({ message: 'One or both shifts not found' });
    if (shift1.date.toDateString() === shift2.date.toDateString()) {
      return res.status(400).json({ message: 'Cannot swap shifts on the same day' });
    }

    // Availability checks for temporary staff
    if (shift1.staff.staffType === 'temporary') {
      const avail = await prisma.availability.findFirst({ where: { staffId: shift1.staff.id, staff: { organizationId: orgId }, startTime: { lte: shift2.date }, endTime: { gte: shift2.date } } });
      if (!avail) return res.status(400).json({ message: `${shift1.staff.name} is not available for ${shift2.date.toDateString()}` });
    }
    if (shift2.staff.staffType === 'temporary') {
      const avail = await prisma.availability.findFirst({ where: { staffId: shift2.staff.id, staff: { organizationId: orgId }, startTime: { lte: shift1.date }, endTime: { gte: shift1.date } } });
      if (!avail) return res.status(400).json({ message: `${shift2.staff.name} is not available for ${shift1.date.toDateString()}` });
    }

    // Conflict checks
    const [conflict1, conflict2] = await Promise.all([
      prisma.shift.findFirst({ where: { staffId: shift1.staff.id, date: shift2.date, id: { not: shift1Id }, organizationId: orgId } }),
      prisma.shift.findFirst({ where: { staffId: shift2.staff.id, date: shift1.date, id: { not: shift2Id }, organizationId: orgId } })
    ]);

    if (conflict1) return res.status(400).json({ message: `${shift1.staff.name} is already assigned on ${shift2.date.toDateString()}` });
    if (conflict2) return res.status(400).json({ message: `${shift2.staff.name} is already assigned on ${shift1.date.toDateString()}` });

    const result = await prisma.$transaction(async (tx) => {
      const staffSelect = { select: { id: true, name: true, gender: true, staffType: true } };
      const [updated1, updated2] = await Promise.all([
        tx.shift.update({ where: { id: shift1Id }, data: { staffId: shift2.staff.id }, include: { staff: staffSelect } }),
        tx.shift.update({ where: { id: shift2Id }, data: { staffId: shift1.staff.id }, include: { staff: staffSelect } })
      ]);
      return { shift1: updated1, shift2: updated2 };
    });

    res.json({ message: 'Staff members swapped successfully', result });
  } catch (error) {
    console.error('Swap staff error:', error);
    res.status(500).json({ message: 'Failed to swap staff members' });
  }
});

// GET available staff for a date/shift
router.get('/available-staff', async (req: AuthRequest, res: Response) => {
  try {
    const { date, shiftType } = req.query;
    if (!date || !shiftType) return res.status(400).json({ message: 'Date and shiftType are required' });

    const targetDate = new Date(date as string);

    const orgId = req.user!.organizationId;
    const [allStaff, existingAssignments, availabilities] = await Promise.all([
      prisma.staff.findMany({ where: { isActive: true, organizationId: orgId }, orderBy: { name: 'asc' } }),
      prisma.shift.findMany({ where: { date: targetDate, organizationId: orgId } }),
      prisma.availability.findMany({ where: { startTime: { lte: targetDate }, endTime: { gte: targetDate }, staff: { organizationId: orgId } } })
    ]);

    const assignedIds = new Set(existingAssignments.map(a => a.staffId));
    const availableStaffIds = new Set(availabilities.map(a => a.staffId));

    const availableStaff = allStaff.filter(staff => {
      if (assignedIds.has(staff.id)) return false;
      if (staff.staffType === 'temporary') return availableStaffIds.has(staff.id);
      return true;
    });

    res.json({ availableStaff: availableStaff.map(s => ({ id: s.id, name: s.name, gender: s.gender, staffType: s.staffType })) });
  } catch (error) {
    console.error('Get available staff error:', error);
    res.status(500).json({ message: 'Failed to get available staff' });
  }
});

// GET shift details
router.get('/shift/:shiftId', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const shift = await prisma.shift.findFirst({
      where: { id: req.params.shiftId, organizationId: orgId },
      include: { staff: { select: { id: true, name: true, gender: true, staffType: true } } }
    });
    if (!shift) return res.status(404).json({ message: 'Shift not found' });
    res.json({ shift });
  } catch (error) {
    console.error('Get shift error:', error);
    res.status(500).json({ message: 'Failed to get shift details' });
  }
});

export default router;
