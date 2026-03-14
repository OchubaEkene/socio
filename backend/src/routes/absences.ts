import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { sendApprovalNotification } from '../services/emailService';

const router = Router();

// GET all absences (with filtering)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status, staffId, startDate, endDate, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    const orgId = req.user!.organizationId;

    const whereClause: any = { organizationId: orgId };
    
    if (status) {
      whereClause.status = status;
    }
    
    if (staffId) {
      whereClause.staffId = staffId;
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

    const absences = await prisma.absence.findMany({
      where: whereClause,
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true
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

    const total = await prisma.absence.count({
      where: whereClause
    });

    res.json({
      success: true,
      data: {
        absences,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('GET /api/absences error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get absences' 
    });
  }
});

// GET pending absences (for managers)
router.get('/pending', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const absences = await prisma.absence.findMany({
      where: { status: 'PENDING', organizationId: orgId },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      success: true,
      data: { absences }
    });
  } catch (error) {
    console.error('GET /api/absences/pending error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get pending absences' 
    });
  }
});

// POST create new absence
router.post('/', authenticateToken, [
  body('staffId').isString().notEmpty().withMessage('Staff ID is required'),
  body('absenceType').isIn(['SICK_LEAVE', 'PERSONAL_LEAVE', 'EMERGENCY', 'OTHER']).withMessage('Invalid absence type'),
  body('startDate').isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').isISO8601().withMessage('End date must be a valid date'),
  body('reason').isString().notEmpty().withMessage('Reason is required'),
  body('notes').optional().isString()
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { staffId, absenceType, startDate, endDate, reason, notes } = req.body;
    const orgId = req.user!.organizationId;

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

    // Check for overlapping absences
    const overlappingAbsence = await prisma.absence.findFirst({
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

    if (overlappingAbsence) {
      return res.status(409).json({
        success: false,
        message: 'Absence overlaps with existing approved or pending absence'
      });
    }

    const absence = await prisma.absence.create({
      data: {
        staffId,
        absenceType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        notes,
        organizationId: orgId,
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Absence request created successfully',
      data: { absence }
    });
  } catch (error) {
    console.error('POST /api/absences error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create absence request' 
    });
  }
});

// PATCH approve/reject absence
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

    const absence = await prisma.absence.findUnique({
      where: { id },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!absence) {
      return res.status(404).json({
        success: false,
        message: 'Absence request not found'
      });
    }

    if (absence.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Absence request has already been processed'
      });
    }

    const updatedAbsence = await prisma.absence.update({
      where: { id },
      data: {
        status,
        approvedBy: approverId,
        approvedAt: new Date(),
        notes: notes || absence.notes
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true
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
      message: `Absence request ${status.toLowerCase()} successfully`,
      data: { absence: updatedAbsence }
    });

    // Fire-and-forget email notification
    if (updatedAbsence.staff?.email) {
      sendApprovalNotification({
        staffEmail: updatedAbsence.staff.email,
        staffName: updatedAbsence.staff.name,
        requestType: 'absence',
        status,
        detail: `${absence.absenceType.replace('_', ' ')} from ${absence.startDate.toDateString()} to ${absence.endDate.toDateString()}`,
      });
    }
  } catch (error) {
    console.error('PATCH /api/absences/:id/approve error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process absence request' 
    });
  }
});

// GET absence by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const absence = await prisma.absence.findUnique({
      where: { id },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true
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

    if (!absence) {
      return res.status(404).json({
        success: false,
        message: 'Absence request not found'
      });
    }

    res.json({
      success: true,
      data: { absence }
    });
  } catch (error) {
    console.error('GET /api/absences/:id error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get absence request' 
    });
  }
});

// DELETE cancel absence (only by the staff member who created it)
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const absence = await prisma.absence.findUnique({
      where: { id },
      include: {
        staff: true
      }
    });

    if (!absence) {
      return res.status(404).json({
        success: false,
        message: 'Absence request not found'
      });
    }

    // Only allow cancellation if status is PENDING
    if (absence.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Only pending absence requests can be cancelled'
      });
    }

    await prisma.absence.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    res.json({
      success: true,
      message: 'Absence request cancelled successfully'
    });
  } catch (error) {
    console.error('DELETE /api/absences/:id error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to cancel absence request' 
    });
  }
});

export default router;
