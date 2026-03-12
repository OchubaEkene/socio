import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// All staff routes require authentication
router.use(authenticateToken);

// GET all staff
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = (page - 1) * limit;
    const { search, staffType } = req.query;

    const showArchived = req.query.showArchived === 'true';
    const where: any = { isActive: showArchived ? undefined : true };
    if (search) where.name = { contains: search as string, mode: 'insensitive' };
    if (staffType && staffType !== 'all') where.staffType = staffType;

    const [staff, total] = await Promise.all([
      prisma.staff.findMany({
        where,
        include: { _count: { select: { availabilities: true, shifts: true, absences: true } } },
        skip,
        take: limit,
        orderBy: { name: 'asc' }
      }),
      prisma.staff.count({ where })
    ]);

    res.json({ staff, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ message: 'Failed to get staff' });
  }
});

// GET single staff member
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const staff = await prisma.staff.findUnique({
      where: { id },
      include: {
        availabilities: { orderBy: { startTime: 'asc' } },
        shifts: { orderBy: { date: 'desc' } },
        _count: { select: { availabilities: true, shifts: true } }
      }
    });

    if (!staff) return res.status(404).json({ message: 'Staff member not found' });

    res.json(staff);
  } catch (error) {
    console.error('Get staff member error:', error);
    res.status(500).json({ message: 'Failed to get staff member' });
  }
});

// POST create staff — managers and admins only
router.post('/', requireRole('admin', 'manager'), [
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('gender').isIn(['male', 'female']),
  body('staffType').isIn(['permanent', 'temporary']),
  body('email').optional().custom((value) => {
    if (!value || value === '') return true;
    return typeof value === 'string' && value.includes('@');
  })
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, gender, staffType, email, qualifications, maxHoursPerWeek } = req.body;

    const staff = await prisma.staff.create({
      data: {
        name, gender, staffType,
        email: email === '' ? null : (email || null),
        qualifications: qualifications || [],
        maxHoursPerWeek: maxHoursPerWeek != null ? parseInt(maxHoursPerWeek) : null,
      },
      include: { _count: { select: { availabilities: true, shifts: true, absences: true } } }
    });

    res.status(201).json({ message: 'Staff member created successfully', staff });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ message: 'Failed to create staff member' });
  }
});

// PUT update staff — managers and admins only
router.put('/:id', requireRole('admin', 'manager'), [
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('gender').optional().isIn(['male', 'female']),
  body('staffType').optional().isIn(['permanent', 'temporary']),
  body('email').optional().isEmail()
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { id } = req.params;
    const { name, gender, staffType, email, qualifications, maxHoursPerWeek } = req.body;

    const existing = await prisma.staff.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Staff member not found' });

    const updatedStaff = await prisma.staff.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(gender && { gender }),
        ...(staffType && { staffType }),
        ...(email !== undefined && { email }),
        ...(qualifications !== undefined && { qualifications }),
        ...('maxHoursPerWeek' in req.body && { maxHoursPerWeek: maxHoursPerWeek != null && maxHoursPerWeek !== '' ? parseInt(maxHoursPerWeek) : null }),
      },
      include: { _count: { select: { availabilities: true, shifts: true, absences: true } } }
    });

    res.json({ message: 'Staff member updated successfully', staff: updatedStaff });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ message: 'Failed to update staff member' });
  }
});

// DELETE (archive) staff — managers and admins; never hard-deletes so history is preserved
router.delete('/:id', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff) return res.status(404).json({ message: 'Staff member not found' });

    // Soft delete — mark inactive so name is preserved in historical shifts
    await prisma.staff.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Staff member archived. Their shift history is preserved.' });
  } catch (error) {
    console.error('Archive staff error:', error);
    res.status(500).json({ message: 'Failed to archive staff member' });
  }
});

// PATCH restore archived staff
router.patch('/:id/restore', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.staff.update({ where: { id }, data: { isActive: true } });
    res.json({ message: 'Staff member restored.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to restore staff member' });
  }
});

// GET staff availabilities
router.get('/:id/availabilities', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const availabilities = await prisma.availability.findMany({
      where: { staffId: id },
      orderBy: { startTime: 'asc' }
    });
    res.json({ availabilities });
  } catch (error) {
    console.error('Get availabilities error:', error);
    res.status(500).json({ message: 'Failed to get availabilities' });
  }
});

// POST add availability
router.post('/:id/availabilities', [
  body('startTime').isISO8601(),
  body('endTime').isISO8601()
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { id } = req.params;
    const { startTime, endTime } = req.body;

    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff) return res.status(404).json({ message: 'Staff member not found' });

    const availability = await prisma.availability.create({
      data: { staffId: id, startTime: new Date(startTime), endTime: new Date(endTime) }
    });

    res.status(201).json({ message: 'Availability added successfully', availability });
  } catch (error) {
    console.error('Add availability error:', error);
    res.status(500).json({ message: 'Failed to add availability' });
  }
});

// GET staff shifts
router.get('/:id/shifts', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const where: any = { staffId: id };
    if (startDate && endDate) {
      where.date = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    const [shifts, total] = await Promise.all([
      prisma.shift.findMany({ where, skip, take: limit, orderBy: { date: 'asc' } }),
      prisma.shift.count({ where })
    ]);

    res.json({ shifts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Get shifts error:', error);
    res.status(500).json({ message: 'Failed to get shifts' });
  }
});

// POST add shift — managers and admins only
router.post('/:id/shifts', requireRole('admin', 'manager'), [
  body('shiftType').isIn(['day', 'night']),
  body('date').isISO8601(),
  body('startTime').isISO8601(),
  body('endTime').isISO8601()
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { id } = req.params;
    const { shiftType, date, startTime, endTime } = req.body;

    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff) return res.status(404).json({ message: 'Staff member not found' });

    const shift = await prisma.shift.create({
      data: { staffId: id, shiftType, date: new Date(date), startTime: new Date(startTime), endTime: new Date(endTime) }
    });

    res.status(201).json({ message: 'Shift added successfully', shift });
  } catch (error) {
    console.error('Add shift error:', error);
    res.status(500).json({ message: 'Failed to add shift' });
  }
});

export default router;
