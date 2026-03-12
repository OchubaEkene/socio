import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';
import { differenceInDays, addDays } from 'date-fns';
import { sendApprovalNotification } from '../services/emailService';

const router = Router();

// GET all vacation requests (with filtering)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status, staffId, vacationType, startDate, endDate, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {};
    
    if (status) {
      whereClause.status = status;
    }
    
    if (staffId) {
      whereClause.staffId = staffId;
    }
    
    if (vacationType) {
      whereClause.vacationType = vacationType;
    }
    
    if (startDate && endDate) {
      whereClause.OR = [
        {
          startDate: {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string)
          }
        },
        {
          endDate: {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string)
          }
        }
      ];
    }

    const vacations = await prisma.vacationRequest.findMany({
      where: whereClause,
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true,
            staffType: true
          }
        },
        approver: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' }
    });

    const total = await prisma.vacationRequest.count({
      where: whereClause
    });

    res.json({
      success: true,
      data: {
        vacations,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('GET /api/vacations error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get vacation requests' 
    });
  }
});

// GET pending vacation requests (for managers)
router.get('/pending', authenticateToken, async (req: Request, res: Response) => {
  try {
    const vacations = await prisma.vacationRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true,
            staffType: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      success: true,
      data: { vacations }
    });
  } catch (error) {
    console.error('GET /api/vacations/pending error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get pending vacation requests' 
    });
  }
});

// GET vacation policies
router.get('/policies', authenticateToken, async (req: Request, res: Response) => {
  try {
    const policies = await prisma.vacationPolicy.findMany({
      orderBy: [
        { staffType: 'asc' },
        { vacationType: 'asc' }
      ]
    });

    res.json({
      success: true,
      data: { policies }
    });
  } catch (error) {
    console.error('GET /api/vacations/policies error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get vacation policies' 
    });
  }
});

// POST create new vacation request
router.post('/', authenticateToken, [
  body('staffId').isString().notEmpty().withMessage('Staff ID is required'),
  body('vacationType').isIn(['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT', 'OTHER']).withMessage('Invalid vacation type'),
  body('startDate').isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').isISO8601().withMessage('End date must be a valid date'),
  body('reason').isString().notEmpty().withMessage('Reason is required'),
  body('notes').optional().isString()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { staffId, vacationType, startDate, endDate, reason, notes } = req.body;

    // Check if staff exists
    const staff = await prisma.staff.findUnique({
      where: { id: staffId }
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Calculate total days
    const totalDays = differenceInDays(new Date(endDate), new Date(startDate)) + 1;

    // Check vacation policy
    const policy = await prisma.vacationPolicy.findFirst({
      where: {
        staffType: staff.staffType,
        vacationType
      }
    });

    if (policy) {
      // Check minimum notice
      const noticeDays = differenceInDays(new Date(startDate), new Date());
      if (noticeDays < policy.minNoticeDays) {
        return res.status(400).json({
          success: false,
          message: `Minimum notice required: ${policy.minNoticeDays} days`
        });
      }

      // Check maximum consecutive days
      if (totalDays > policy.maxConsecutiveDays) {
        return res.status(400).json({
          success: false,
          message: `Maximum consecutive days allowed: ${policy.maxConsecutiveDays}`
        });
      }
    }

    // Check for overlapping vacation requests
    const overlappingVacation = await prisma.vacationRequest.findFirst({
      where: {
        staffId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            startDate: { lte: new Date(endDate) },
            endDate: { gte: new Date(startDate) }
          }
        ]
      }
    });

    if (overlappingVacation) {
      return res.status(409).json({
        success: false,
        message: 'Vacation request overlaps with existing approved or pending request'
      });
    }

    const vacation = await prisma.vacationRequest.create({
      data: {
        staffId,
        vacationType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totalDays,
        reason,
        notes
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true,
            staffType: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Vacation request created successfully',
      data: { vacation }
    });
  } catch (error) {
    console.error('POST /api/vacations error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create vacation request' 
    });
  }
});

// PATCH approve/reject vacation request
router.patch('/:id/approve', authenticateToken, [
  body('status').isIn(['APPROVED', 'REJECTED']).withMessage('Status must be APPROVED or REJECTED'),
  body('notes').optional().isString()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { id } = req.params;
    const { status, notes } = req.body;
    const approverId = (req as any).user.id;

    const vacation = await prisma.vacationRequest.findUnique({
      where: { id },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true,
            staffType: true
          }
        }
      }
    });

    if (!vacation) {
      return res.status(404).json({
        success: false,
        message: 'Vacation request not found'
      });
    }

    if (vacation.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Vacation request has already been processed'
      });
    }

    const updatedVacation = await prisma.vacationRequest.update({
      where: { id },
      data: {
        status,
        approvedBy: approverId,
        approvedAt: new Date(),
        notes: notes || vacation.notes
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true,
            staffType: true
          }
        },
        approver: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: `Vacation request ${status.toLowerCase()} successfully`,
      data: { vacation: updatedVacation }
    });

    if (updatedVacation.staff?.email) {
      sendApprovalNotification({
        staffEmail: updatedVacation.staff.email,
        staffName: updatedVacation.staff.name,
        requestType: 'vacation',
        status,
        detail: `${vacation.vacationType} leave: ${vacation.startDate.toDateString()} – ${vacation.endDate.toDateString()} (${vacation.totalDays} days)`,
      });
    }
  } catch (error) {
    console.error('PATCH /api/vacations/:id/approve error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process vacation request' 
    });
  }
});

// POST create vacation policy
router.post('/policies', authenticateToken, [
  body('staffType').isIn(['permanent', 'temporary']).withMessage('Invalid staff type'),
  body('vacationType').isIn(['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT', 'OTHER']).withMessage('Invalid vacation type'),
  body('annualAllowance').isInt({ min: 0 }).withMessage('Annual allowance must be a positive integer'),
  body('carryOverLimit').optional().isInt({ min: 0 }).withMessage('Carry over limit must be a positive integer'),
  body('minNoticeDays').optional().isInt({ min: 0 }).withMessage('Minimum notice days must be a positive integer'),
  body('maxConsecutiveDays').optional().isInt({ min: 1 }).withMessage('Maximum consecutive days must be at least 1')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { staffType, vacationType, annualAllowance, carryOverLimit = 0, minNoticeDays = 14, maxConsecutiveDays = 30 } = req.body;

    // Check if policy already exists
    const existingPolicy = await prisma.vacationPolicy.findFirst({
      where: {
        staffType,
        vacationType
      }
    });

    if (existingPolicy) {
      return res.status(409).json({
        success: false,
        message: 'Policy already exists for this staff type and vacation type'
      });
    }

    const policy = await prisma.vacationPolicy.create({
      data: {
        staffType,
        vacationType,
        annualAllowance,
        carryOverLimit,
        minNoticeDays,
        maxConsecutiveDays
      }
    });

    res.status(201).json({
      success: true,
      message: 'Vacation policy created successfully',
      data: { policy }
    });
  } catch (error) {
    console.error('POST /api/vacations/policies error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create vacation policy' 
    });
  }
});

// GET vacation balance for a staff member (days used vs allowance this year)
router.get('/balance/:staffId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { staffId } = req.params;
    const year = new Date().getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found' });

    // Sum approved vacation days per type this year
    const approved = await prisma.vacationRequest.findMany({
      where: {
        staffId,
        status: 'APPROVED',
        startDate: { gte: yearStart, lte: yearEnd },
      },
      select: { vacationType: true, totalDays: true },
    });

    // Get policies for this staff type
    const policies = await prisma.vacationPolicy.findMany({ where: { staffType: staff.staffType } });

    const balanceByType: Record<string, { used: number; allowance: number; remaining: number }> = {};

    for (const policy of policies) {
      const used = approved
        .filter(a => a.vacationType === policy.vacationType)
        .reduce((sum, a) => sum + (a.totalDays || 0), 0);
      balanceByType[policy.vacationType] = {
        used,
        allowance: policy.annualAllowance,
        remaining: Math.max(0, policy.annualAllowance - used),
      };
    }

    // Any used types not covered by a policy
    const usedByType = approved.reduce((acc: Record<string, number>, a) => {
      acc[a.vacationType] = (acc[a.vacationType] || 0) + (a.totalDays || 0);
      return acc;
    }, {});
    for (const [type, used] of Object.entries(usedByType)) {
      if (!balanceByType[type]) {
        balanceByType[type] = { used, allowance: 0, remaining: 0 };
      }
    }

    res.json({ success: true, data: { staffId, year, balanceByType } });
  } catch (error) {
    console.error('GET /api/vacations/balance/:staffId error:', error);
    res.status(500).json({ success: false, message: 'Failed to get vacation balance' });
  }
});

// GET vacation request by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const vacation = await prisma.vacationRequest.findUnique({
      where: { id },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true,
            staffType: true
          }
        },
        approver: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!vacation) {
      return res.status(404).json({
        success: false,
        message: 'Vacation request not found'
      });
    }

    res.json({
      success: true,
      data: { vacation }
    });
  } catch (error) {
    console.error('GET /api/vacations/:id error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get vacation request' 
    });
  }
});

export default router;
