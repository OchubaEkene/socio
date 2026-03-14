import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

const exceptionInclude = {
  shift: { include: { staff: { select: { id: true, name: true } } } },
  rule: { select: { id: true, name: true, shiftType: true, dayOfWeek: true } }
};

// All exception routes require auth
router.use(authenticateToken);

// GET all exceptions
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { resolved, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const orgId = req.user!.organizationId;

    const where: any = { organizationId: orgId };
    if (resolved !== undefined) where.isResolved = resolved === 'true';

    const [exceptions, total] = await Promise.all([
      prisma.schedulingException.findMany({
        where,
        include: exceptionInclude,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.schedulingException.count({ where })
    ]);

    res.json({ exceptions, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
  } catch (error) {
    console.error('Get scheduling exceptions error:', error);
    res.status(500).json({ message: 'Failed to get scheduling exceptions' });
  }
});

// GET unresolved exceptions
router.get('/unresolved', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const exceptions = await prisma.schedulingException.findMany({
      where: { isResolved: false, organizationId: orgId },
      include: exceptionInclude,
      orderBy: { createdAt: 'desc' }
    });
    res.json({ exceptions });
  } catch (error) {
    console.error('Get unresolved exceptions error:', error);
    res.status(500).json({ message: 'Failed to get unresolved exceptions' });
  }
});

// PATCH mark as resolved — managers and admins only
router.patch('/:id/resolve', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const exception = await prisma.schedulingException.findUnique({ where: { id } });
    if (!exception) return res.status(404).json({ message: 'Scheduling exception not found' });

    const updated = await prisma.schedulingException.update({
      where: { id },
      data: { isResolved: true },
      include: exceptionInclude
    });

    res.json({ message: 'Exception marked as resolved', exception: updated });
  } catch (error) {
    console.error('Resolve exception error:', error);
    res.status(500).json({ message: 'Failed to resolve exception' });
  }
});

// POST create exception — managers and admins only
router.post('/', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { shiftId, ruleId, message } = req.body;

    if (!ruleId || !message) {
      return res.status(400).json({ message: 'Rule ID and message are required' });
    }

    const orgId = req.user!.organizationId;
    const exception = await prisma.schedulingException.create({
      data: { shiftId: shiftId || null, ruleId, message, organizationId: orgId },
      include: exceptionInclude
    });

    res.status(201).json({ message: 'Scheduling exception created successfully', exception });
  } catch (error) {
    console.error('Create scheduling exception error:', error);
    res.status(500).json({ message: 'Failed to create scheduling exception' });
  }
});

// GET exception by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const exception = await prisma.schedulingException.findUnique({
      where: { id: req.params.id },
      include: exceptionInclude
    });

    if (!exception) return res.status(404).json({ message: 'Scheduling exception not found' });

    res.json({ exception });
  } catch (error) {
    console.error('Get exception error:', error);
    res.status(500).json({ message: 'Failed to get exception' });
  }
});

export default router;
