import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { sendApprovalNotification } from '../services/emailService';

const router = Router();

// GET all shift swaps (with filtering)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status, requesterId, responderId, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    const orgId = req.user!.organizationId;

    const whereClause: any = { organizationId: orgId };
    
    if (status) {
      whereClause.status = status;
    }
    
    if (requesterId) {
      whereClause.requesterId = requesterId;
    }
    
    if (responderId) {
      whereClause.responderId = responderId;
    }

    const swaps = await prisma.shiftSwap.findMany({
      where: whereClause,
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        responder: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        requesterShift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            shiftType: true
          }
        },
        responderShift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            shiftType: true
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

    const total = await prisma.shiftSwap.count({
      where: whereClause
    });

    res.json({
      success: true,
      data: {
        swaps,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('GET /api/shift-swaps error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get shift swaps' 
    });
  }
});

// GET pending shift swaps (for managers)
router.get('/pending', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const swaps = await prisma.shiftSwap.findMany({
      where: { status: 'PENDING', organizationId: orgId },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        responder: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        requesterShift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            shiftType: true
          }
        },
        responderShift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            shiftType: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      success: true,
      data: { swaps }
    });
  } catch (error) {
    console.error('GET /api/shift-swaps/pending error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get pending shift swaps' 
    });
  }
});

// GET shift swaps for a specific staff member
router.get('/my-swaps', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const orgId = req.user!.organizationId;

    // Get staff ID for the current user via their User record
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { staffId: true }
    });

    if (!currentUser?.staffId) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    const staff = { id: currentUser.staffId };

    const swaps = await prisma.shiftSwap.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { requesterId: staff.id },
          { responderId: staff.id }
        ]
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        responder: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        requesterShift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            shiftType: true
          }
        },
        responderShift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            shiftType: true
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
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: { swaps }
    });
  } catch (error) {
    console.error('GET /api/shift-swaps/my-swaps error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get shift swaps' 
    });
  }
});

// POST create new shift swap request
router.post('/', authenticateToken, [
  body('requesterId').isString().notEmpty().withMessage('Requester ID is required'),
  body('responderId').isString().notEmpty().withMessage('Responder ID is required'),
  body('requesterShiftId').isString().notEmpty().withMessage('Requester shift ID is required'),
  body('responderShiftId').isString().notEmpty().withMessage('Responder shift ID is required'),
  body('requesterReason').optional().isString()
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

    const { requesterId, responderId, requesterShiftId, responderShiftId, requesterReason } = req.body;
    const orgId = req.user!.organizationId;

    // Check if both staff members exist
    const [requester, responder] = await Promise.all([
      prisma.staff.findFirst({ where: { id: requesterId, organizationId: orgId } }),
      prisma.staff.findFirst({ where: { id: responderId, organizationId: orgId } })
    ]);

    if (!requester || !responder) {
      return res.status(404).json({
        success: false,
        message: 'One or both staff members not found'
      });
    }

    // Check if both shifts exist
    const [requesterShift, responderShift] = await Promise.all([
      prisma.shift.findFirst({ where: { id: requesterShiftId, organizationId: orgId } }),
      prisma.shift.findFirst({ where: { id: responderShiftId, organizationId: orgId } })
    ]);

    if (!requesterShift || !responderShift) {
      return res.status(404).json({
        success: false,
        message: 'One or both shifts not found'
      });
    }

    // Verify that the shifts belong to the correct staff members
    if (requesterShift.staffId !== requesterId) {
      return res.status(400).json({
        success: false,
        message: 'Requester shift does not belong to the requester'
      });
    }

    if (responderShift.staffId !== responderId) {
      return res.status(400).json({
        success: false,
        message: 'Responder shift does not belong to the responder'
      });
    }

    // Check for existing pending swap requests
    const existingSwap = await prisma.shiftSwap.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          {
            requesterShiftId,
            status: 'PENDING'
          },
          {
            responderShiftId,
            status: 'PENDING'
          }
        ]
      }
    });

    if (existingSwap) {
      return res.status(409).json({
        success: false,
        message: 'One or both shifts are already involved in a pending swap request'
      });
    }

    const swap = await prisma.shiftSwap.create({
      data: {
        requesterId,
        responderId,
        requesterShiftId,
        responderShiftId,
        requesterReason,
        organizationId: orgId,
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        responder: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        requesterShift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            shiftType: true
          }
        },
        responderShift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            shiftType: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Shift swap request created successfully',
      data: { swap }
    });
  } catch (error) {
    console.error('POST /api/shift-swaps error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create shift swap request' 
    });
  }
});

// PATCH respond to shift swap (accept/reject)
router.patch('/:id/respond', authenticateToken, [
  body('status').isIn(['STAFF_APPROVED', 'REJECTED']).withMessage('Status must be STAFF_APPROVED or REJECTED'),
  body('responderReason').optional().isString()
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

    const { id } = req.params;
    const { status, responderReason } = req.body;
    const userId = req.user!.id;

    // Get staff ID for the current user via their User record
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { staffId: true }
    });

    if (!currentUser?.staffId) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    const staff = { id: currentUser.staffId };
    const orgId = req.user!.organizationId;

    const swap = await prisma.shiftSwap.findFirst({
      where: { id, organizationId: orgId },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        responder: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        requesterShift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            shiftType: true
          }
        },
        responderShift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            shiftType: true
          }
        }
      }
    });

    if (!swap) {
      return res.status(404).json({
        success: false,
        message: 'Shift swap request not found'
      });
    }

    if (swap.responderId !== staff.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only respond to swap requests where you are the responder'
      });
    }

    if (swap.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Shift swap request has already been processed'
      });
    }

    const updatedSwap = await prisma.shiftSwap.update({
      where: { id },
      data: {
        status,
        responderReason
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        responder: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        requesterShift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            shiftType: true
          }
        },
        responderShift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            shiftType: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: `Shift swap request ${status.toLowerCase()} successfully`,
      data: { swap: updatedSwap }
    });
  } catch (error) {
    console.error('PATCH /api/shift-swaps/:id/respond error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to respond to shift swap request' 
    });
  }
});

// PATCH approve shift swap (manager only)
router.patch('/:id/approve', authenticateToken, [
  body('status').isIn(['APPROVED', 'REJECTED']).withMessage('Status must be APPROVED or REJECTED')
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

    const { id } = req.params;
    const { status } = req.body;
    const approverId = req.user!.id;
    const orgId = req.user!.organizationId;

    const swap = await prisma.shiftSwap.findFirst({
      where: { id, organizationId: orgId },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        responder: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        requesterShift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            shiftType: true
          }
        },
        responderShift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            shiftType: true
          }
        }
      }
    });

    if (!swap) {
      return res.status(404).json({
        success: false,
        message: 'Shift swap request not found'
      });
    }

    if (swap.status !== 'STAFF_APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Shift swap must be approved by both parties before manager approval'
      });
    }

    const updatedSwap = await prisma.shiftSwap.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: approverId,
        approvedAt: new Date()
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        responder: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        requesterShift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            shiftType: true
          }
        },
        responderShift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            shiftType: true
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

    // If approved, actually swap the shifts
    if (status === 'APPROVED') {
      await prisma.$transaction([
        prisma.shift.update({
          where: { id: swap.requesterShiftId },
          data: { staffId: swap.responderId }
        }),
        prisma.shift.update({
          where: { id: swap.responderShiftId },
          data: { staffId: swap.requesterId }
        })
      ]);
    }

    res.json({
      success: true,
      message: `Shift swap ${status.toLowerCase()} successfully`,
      data: { swap: updatedSwap }
    });

    // Notify both parties
    const notifyEmails = [
      { name: updatedSwap.requester?.name, email: updatedSwap.requester?.email },
      { name: updatedSwap.responder?.name, email: updatedSwap.responder?.email },
    ].filter((p): p is { name: string; email: string } => !!(p.name && p.email));
    for (const party of notifyEmails) {
      sendApprovalNotification({ staffEmail: party.email, staffName: party.name, requestType: 'shift_swap', status });
    }
  } catch (error) {
    console.error('PATCH /api/shift-swaps/:id/approve error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to approve shift swap' 
    });
  }
});

// DELETE cancel shift swap (only by the requester)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Get staff ID for the current user via their User record
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { staffId: true }
    });

    if (!currentUser?.staffId) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    const staff = { id: currentUser.staffId };
    const orgId = req.user!.organizationId;

    const swap = await prisma.shiftSwap.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!swap) {
      return res.status(404).json({
        success: false,
        message: 'Shift swap request not found'
      });
    }

    if (swap.requesterId !== staff.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel swap requests that you created'
      });
    }

    if (swap.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Only pending swap requests can be cancelled'
      });
    }

    await prisma.shiftSwap.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    res.json({
      success: true,
      message: 'Shift swap request cancelled successfully'
    });
  } catch (error) {
    console.error('DELETE /api/shift-swaps/:id error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to cancel shift swap request' 
    });
  }
});

export default router;
