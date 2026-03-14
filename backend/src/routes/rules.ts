import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// All rules routes require auth
router.use(authenticateToken);

// GET all rules
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const rules = await prisma.rule.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: { rules } });
  } catch (error) {
    console.error('GET /rules error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rules' });
  }
});

// POST create rule — managers and admins only
router.post('/', requireRole('admin', 'manager'), [
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('shiftType').isIn(['day', 'night']),
  body('shiftName').optional().trim().isLength({ max: 50 }),
  body('startHour').optional().isInt({ min: 0, max: 23 }),
  body('endHour').optional().isInt({ min: 0, max: 23 }),
  body('dayOfWeek').isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'everyday']),
  body('requiredStaff').isInt({ min: 1, max: 50 }),
  body('genderPreference').isIn(['male', 'female', 'any']),
  body('priority').optional().isInt({ min: 1, max: 100 })
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { name, shiftType, shiftName, startHour, endHour, dayOfWeek, requiredStaff, genderPreference, requiredQualifications, priority } = req.body;
    const orgId = req.user!.organizationId;

    const rule = await prisma.rule.create({
      data: {
        name, shiftType, dayOfWeek,
        shiftName: shiftName || null,
        startHour: startHour !== undefined ? parseInt(startHour) : (shiftType === 'day' ? 8 : 20),
        endHour: endHour !== undefined ? parseInt(endHour) : (shiftType === 'day' ? 20 : 8),
        requiredStaff: parseInt(requiredStaff),
        genderPreference,
        requiredQualifications: Array.isArray(requiredQualifications) ? requiredQualifications : [],
        priority: priority ? parseInt(priority) : 1,
        organizationId: orgId,
      }
    });

    res.status(201).json({ success: true, message: 'Rule created successfully', data: { rule } });
  } catch (error) {
    console.error('POST /rules error:', error);
    res.status(500).json({ success: false, message: 'Failed to create rule' });
  }
});

// PUT update rule — managers and admins only
router.put('/:id', requireRole('admin', 'manager'), [
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('shiftType').optional().isIn(['day', 'night']),
  body('shiftName').optional().trim().isLength({ max: 50 }),
  body('startHour').optional().isInt({ min: 0, max: 23 }),
  body('endHour').optional().isInt({ min: 0, max: 23 }),
  body('dayOfWeek').optional().isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'everyday']),
  body('requiredStaff').optional().isInt({ min: 1, max: 50 }),
  body('genderPreference').optional().isIn(['male', 'female', 'any']),
  body('priority').optional().isInt({ min: 1, max: 100 })
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { id } = req.params;
    const { name, shiftType, shiftName, startHour, endHour, dayOfWeek, requiredStaff, genderPreference, requiredQualifications, priority } = req.body;

    const existing = await prisma.rule.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Rule not found' });

    const updatedRule = await prisma.rule.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(shiftType && { shiftType }),
        ...(shiftName !== undefined && { shiftName: shiftName || null }),
        ...(startHour !== undefined && { startHour: parseInt(startHour) }),
        ...(endHour !== undefined && { endHour: parseInt(endHour) }),
        ...(dayOfWeek && { dayOfWeek }),
        ...(requiredStaff && { requiredStaff: parseInt(requiredStaff) }),
        ...(genderPreference && { genderPreference }),
        ...(Array.isArray(requiredQualifications) && { requiredQualifications }),
        ...(priority && { priority: parseInt(priority) })
      }
    });

    res.json({ success: true, message: 'Rule updated successfully', data: { rule: updatedRule } });
  } catch (error) {
    console.error('PUT /rules/:id error:', error);
    res.status(500).json({ success: false, message: 'Failed to update rule' });
  }
});

// DELETE all rules (used by onboarding to reset before re-creating) — managers and admins only
router.delete('/all', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const result = await prisma.rule.deleteMany({ where: { organizationId: orgId } })
    res.json({ success: true, data: { deleted: result.count } })
  } catch (error) {
    console.error('DELETE /rules/all error:', error)
    res.status(500).json({ success: false, message: 'Failed to delete rules' })
  }
})

// DELETE rule — admins only
router.delete('/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const rule = await prisma.rule.findUnique({ where: { id } });
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });

    await prisma.rule.delete({ where: { id } });
    res.json({ success: true, message: 'Rule deleted successfully' });
  } catch (error) {
    console.error('DELETE /rules/:id error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete rule' });
  }
});

export default router;
