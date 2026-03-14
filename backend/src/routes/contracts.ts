import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// GET contracts — managers see all, staff see their own
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { staffId, isActive } = req.query;
    const orgId = req.user!.organizationId;
    const where: any = { staff: { organizationId: orgId } };

    if (req.user!.role === 'staff') {
      const userWithStaff = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { staffId: true }
      });
      if (!userWithStaff?.staffId) {
        return res.json({ success: true, data: { contracts: [] } });
      }
      where.staffId = userWithStaff.staffId;
    } else {
      if (staffId) where.staffId = staffId as string;
    }

    if (isActive !== undefined) where.isActive = isActive === 'true';

    const contracts = await prisma.employeeContract.findMany({
      where,
      include: {
        staff: { select: { id: true, name: true, staffType: true } },
        manager: { select: { id: true, name: true } },
        shiftPreferences: true
      },
      orderBy: { startDate: 'desc' }
    });

    res.json({ success: true, data: { contracts } });
  } catch (error) {
    console.error('GET /contracts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch contracts' });
  }
});

// GET single contract
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const contract = await prisma.employeeContract.findUnique({
      where: { id },
      include: {
        staff: { select: { id: true, name: true, staffType: true } },
        manager: { select: { id: true, name: true } },
        shiftPreferences: true
      }
    });
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });

    // Staff can only see their own
    if (req.user!.role === 'staff') {
      const userWithStaff = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { staffId: true } });
      if (contract.staffId !== userWithStaff?.staffId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    res.json({ success: true, data: { contract } });
  } catch (error) {
    console.error('GET /contracts/:id error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch contract' });
  }
});

// POST create contract — manager/admin only
router.post('/', requireRole('admin', 'manager'), [
  body('staffId').isString().notEmpty(),
  body('contractType').isIn(['FULL_TIME', 'PART_TIME', 'TEMPORARY', 'CONTRACTOR', 'INTERN']),
  body('startDate').isISO8601(),
  body('noticePeriod').isInt({ min: 0 }),
  body('workingHoursPerWeek').isFloat({ min: 0 }),
  body('endDate').optional().isISO8601(),
  body('probationEndDate').optional().isISO8601(),
  body('position').optional().isString(),
  body('department').optional().isString(),
  body('hourlyRate').optional().isFloat({ min: 0 }),
  body('salary').optional().isFloat({ min: 0 }),
  body('currency').optional().isString(),
  body('managerId').optional().isString(),
  body('costCenter').optional().isString(),
  body('benefits').optional().isArray(),
  body('qualifications').optional().isArray(),
  body('restrictions').optional().isArray(),
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const {
      staffId, contractType, startDate, endDate, probationEndDate,
      noticePeriod, workingHoursPerWeek, hourlyRate, salary, currency,
      position, department, managerId, costCenter, benefits, qualifications, restrictions
    } = req.body;

    const orgId = req.user!.organizationId;
    const staff = await prisma.staff.findFirst({ where: { id: staffId, organizationId: orgId } });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });

    const contract = await prisma.employeeContract.create({
      data: {
        staffId,
        contractType,
        startDate: new Date(startDate),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(probationEndDate && { probationEndDate: new Date(probationEndDate) }),
        noticePeriod,
        workingHoursPerWeek,
        ...(hourlyRate !== undefined && { hourlyRate }),
        ...(salary !== undefined && { salary }),
        ...(currency && { currency }),
        ...(position && { position }),
        ...(department && { department }),
        ...(managerId && { managerId }),
        ...(costCenter && { costCenter }),
        benefits: benefits || [],
        qualifications: qualifications || [],
        restrictions: restrictions || [],
      },
      include: {
        staff: { select: { id: true, name: true, staffType: true } },
        manager: { select: { id: true, name: true } },
      }
    });

    res.status(201).json({ success: true, message: 'Contract created', data: { contract } });
  } catch (error) {
    console.error('POST /contracts error:', error);
    res.status(500).json({ success: false, message: 'Failed to create contract' });
  }
});

// PATCH update contract — manager/admin only
router.patch('/:id', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.employeeContract.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Contract not found' });

    const {
      contractType, employmentStatus, endDate, probationEndDate, noticePeriod,
      workingHoursPerWeek, hourlyRate, salary, currency, position, department,
      managerId, costCenter, benefits, qualifications, restrictions, isActive
    } = req.body;

    const data: any = {};
    if (contractType) data.contractType = contractType;
    if (employmentStatus) data.employmentStatus = employmentStatus;
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
    if (probationEndDate !== undefined) data.probationEndDate = probationEndDate ? new Date(probationEndDate) : null;
    if (noticePeriod !== undefined) data.noticePeriod = noticePeriod;
    if (workingHoursPerWeek !== undefined) data.workingHoursPerWeek = workingHoursPerWeek;
    if (hourlyRate !== undefined) data.hourlyRate = hourlyRate;
    if (salary !== undefined) data.salary = salary;
    if (currency) data.currency = currency;
    if (position !== undefined) data.position = position;
    if (department !== undefined) data.department = department;
    if (managerId !== undefined) data.managerId = managerId || null;
    if (costCenter !== undefined) data.costCenter = costCenter;
    if (benefits) data.benefits = benefits;
    if (qualifications) data.qualifications = qualifications;
    if (restrictions) data.restrictions = restrictions;
    if (isActive !== undefined) data.isActive = isActive;

    const contract = await prisma.employeeContract.update({
      where: { id },
      data,
      include: {
        staff: { select: { id: true, name: true, staffType: true } },
        manager: { select: { id: true, name: true } },
        shiftPreferences: true
      }
    });

    res.json({ success: true, message: 'Contract updated', data: { contract } });
  } catch (error) {
    console.error('PATCH /contracts/:id error:', error);
    res.status(500).json({ success: false, message: 'Failed to update contract' });
  }
});

// DELETE contract — admin only
router.delete('/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.employeeContract.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Contract not found' });
    await prisma.employeeContract.delete({ where: { id } });
    res.json({ success: true, message: 'Contract deleted' });
  } catch (error) {
    console.error('DELETE /contracts/:id error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete contract' });
  }
});

// POST add shift preference to a contract — manager/admin only
router.post('/:id/preferences', requireRole('admin', 'manager'), [
  body('dayOfWeek').isIn(['monday','tuesday','wednesday','thursday','friday','saturday','sunday']),
  body('shiftType').isIn(['day','night']),
  body('preferenceType').isIn(['PREFERRED','AVAILABLE','UNAVAILABLE','RESTRICTED']),
  body('reason').optional().isIn(['PERSONAL','MEDICAL','LEGAL','TRAINING','OTHER']),
  body('notes').optional().isString(),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { id } = req.params;
    const contract = await prisma.employeeContract.findUnique({ where: { id } });
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });

    const { dayOfWeek, shiftType, preferenceType, reason, notes, startDate, endDate } = req.body;

    const preference = await prisma.shiftPreference.upsert({
      where: { contractId_dayOfWeek_shiftType: { contractId: id, dayOfWeek, shiftType } },
      create: {
        contractId: id,
        dayOfWeek,
        shiftType,
        preferenceType,
        ...(reason && { reason }),
        ...(notes && { notes }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
      },
      update: {
        preferenceType,
        ...(reason !== undefined && { reason }),
        ...(notes !== undefined && { notes }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      },
    });

    res.status(201).json({ success: true, message: 'Shift preference saved', data: { preference } });
  } catch (error) {
    console.error('POST /contracts/:id/preferences error:', error);
    res.status(500).json({ success: false, message: 'Failed to save shift preference' });
  }
});

// DELETE shift preference
router.delete('/:id/preferences/:prefId', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { prefId } = req.params;
    const existing = await prisma.shiftPreference.findUnique({ where: { id: prefId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Preference not found' });
    await prisma.shiftPreference.delete({ where: { id: prefId } });
    res.json({ success: true, message: 'Preference deleted' });
  } catch (error) {
    console.error('DELETE /contracts/:id/preferences/:prefId error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete preference' });
  }
});

export default router;
