import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// All availability routes require authentication
router.use(authenticateToken);

// GET all availabilities for managers (to view all staff submissions)
router.get('/all', async (req: AuthRequest, res: Response) => {
  try {
    const { week, staffType } = req.query;
    const orgId = req.user!.organizationId;

    let whereClause: any = { staff: { organizationId: orgId } };

    // Filter by week if provided
    if (week) {
      const weekStart = new Date(week as string);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      whereClause.startTime = {
        gte: weekStart,
        lt: weekEnd
      };
    }

    // Get all availabilities with staff information
    const availabilities = await prisma.availability.findMany({
      where: whereClause,
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            staffType: true,
            gender: true
          }
        }
      },
      orderBy: [
        { staff: { name: 'asc' } },
        { startTime: 'asc' }
      ]
    });

    // Group by staff member
    const staffAvailabilities = availabilities.reduce((acc, availability) => {
      const staffId = availability.staffId;
      if (!acc[staffId]) {
        acc[staffId] = {
          staff: availability.staff,
          availabilities: []
        };
      }
      acc[staffId].availabilities.push({
        id: availability.id,
        startTime: availability.startTime,
        endTime: availability.endTime
      });
      return acc;
    }, {} as any);

    // Filter by staff type if provided
    let result = Object.values(staffAvailabilities);
    if (staffType) {
      result = result.filter((item: any) => item.staff.staffType === staffType);
    }

    res.json({
      success: true,
      data: {
        staffAvailabilities: result,
        totalStaff: result.length,
        totalAvailabilities: availabilities.length
      }
    });
  } catch (error) {
    console.error('GET /availability/all error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch all availabilities' 
    });
  }
});

// GET all availabilities for a staff member
router.get('/staff/:staffId', async (req: Request, res: Response) => {
  try {
    const { staffId } = req.params;
    const { week } = req.query; // Optional: filter by week
    const orgId = (req as any).user?.organizationId;

    // Check if staff member exists
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, organizationId: orgId }
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    let whereClause: any = { staffId };

    // Filter by week if provided
    if (week) {
      const weekStart = new Date(week as string);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      whereClause.startTime = {
        gte: weekStart,
        lt: weekEnd
      };
    }

    const availabilities = await prisma.availability.findMany({
      where: whereClause,
      orderBy: { startTime: 'asc' }
    });

    res.json({
      success: true,
      data: {
        availabilities,
        staff: {
          id: staff.id,
          name: staff.name,
          staffType: staff.staffType
        }
      }
    });
  } catch (error) {
    console.error('GET /availability/staff/:staffId error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch availabilities' 
    });
  }
});

// POST single availability for a staff member
router.post('/staff/:staffId', [
  body('startTime')
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date'),
  body('endTime')
    .isISO8601()
    .withMessage('End time must be a valid ISO 8601 date')
], async (req: Request, res: Response) => {
  try {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { staffId } = req.params;
    const { startTime, endTime } = req.body;
    const orgId = (req as any).user?.organizationId;

    // Check if staff member exists
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, organizationId: orgId }
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Validate time range
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      return res.status(400).json({ 
        success: false, 
        message: 'End time must be after start time' 
      });
    }

    // Check for overlapping availabilities
    const overlapping = await prisma.availability.findFirst({
      where: {
        staffId,
        OR: [
          {
            startTime: { lt: end },
            endTime: { gt: start }
          }
        ]
      }
    });

    if (overlapping) {
      return res.status(409).json({ 
        success: false, 
        message: 'Availability overlaps with existing time slot' 
      });
    }

    // Create availability
    const availability = await prisma.availability.create({
      data: {
        staffId,
        startTime: start,
        endTime: end
      }
    });

    res.status(201).json({
      success: true,
      message: 'Availability added successfully',
      data: {
        availability
      }
    });
  } catch (error) {
    console.error('POST /availability/staff/:staffId error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add availability' 
    });
  }
});

// POST multiple availabilities for a staff member (for weekly submissions)
router.post('/staff/:staffId/bulk', [
  body('availabilities')
    .isArray({ min: 1 })
    .withMessage('Availabilities must be an array with at least one item'),
  body('availabilities.*.startTime')
    .isISO8601()
    .withMessage('Each start time must be a valid ISO 8601 date'),
  body('availabilities.*.endTime')
    .isISO8601()
    .withMessage('Each end time must be a valid ISO 8601 date')
], async (req: Request, res: Response) => {
  try {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { staffId } = req.params;
    const { availabilities } = req.body;
    const orgId = (req as any).user?.organizationId;

    // Check if staff member exists
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, organizationId: orgId }
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Validate all time ranges
    for (const availability of availabilities) {
      const start = new Date(availability.startTime);
      const end = new Date(availability.endTime);

      if (start >= end) {
        return res.status(400).json({ 
          success: false, 
          message: 'End time must be after start time for all availabilities' 
        });
      }
    }

    // Use transaction to ensure all availabilities are created or none
    const result = await prisma.$transaction(async (tx) => {
      const createdAvailabilities = [];

      for (const availability of availabilities) {
        const start = new Date(availability.startTime);
        const end = new Date(availability.endTime);

        // Check for overlapping availabilities
        const overlapping = await tx.availability.findFirst({
          where: {
            staffId,
            OR: [
              {
                startTime: { lt: end },
                endTime: { gt: start }
              }
            ]
          }
        });

        if (overlapping) {
          throw new Error(`Availability overlaps with existing time slot: ${start.toISOString()} - ${end.toISOString()}`);
        }

        // Create availability
        const created = await tx.availability.create({
          data: {
            staffId,
            startTime: start,
            endTime: end
          }
        });

        createdAvailabilities.push(created);
      }

      return createdAvailabilities;
    });

    res.status(201).json({
      success: true,
      message: `${result.length} availabilities added successfully`,
      data: {
        availabilities: result,
        count: result.length
      }
    });
  } catch (error) {
    console.error('POST /availability/staff/:staffId/bulk error:', error);
    
    if (error instanceof Error && error.message.includes('overlaps')) {
      return res.status(409).json({ 
        success: false, 
        message: error.message 
      });
    }

    res.status(500).json({ 
      success: false, 
      message: 'Failed to add availabilities' 
    });
  }
});

// DELETE availability
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = (req as any).user?.organizationId;

    const existing = await prisma.availability.findFirst({
      where: { id, staff: { organizationId: orgId } }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Availability not found'
      });
    }

    await prisma.availability.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Availability deleted successfully'
    });
  } catch (error) {
    console.error('DELETE /availability/:id error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete availability' 
    });
  }
});

// GET availability statistics for a staff member
router.get('/staff/:staffId/stats', async (req: Request, res: Response) => {
  try {
    const { staffId } = req.params;
    const { period } = req.query; // 'week', 'month', 'all'
    const orgId = (req as any).user?.organizationId;

    // Check if staff member exists
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, organizationId: orgId }
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    let whereClause: any = { staffId };

    // Filter by period if provided
    if (period === 'week') {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);

      whereClause.startTime = {
        gte: weekStart
      };
    } else if (period === 'month') {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      whereClause.startTime = {
        gte: monthStart
      };
    }

    const availabilities = await prisma.availability.findMany({
      where: whereClause,
      orderBy: { startTime: 'asc' }
    });

    // Calculate statistics
    const totalHours = availabilities.reduce((total, availability) => {
      const duration = new Date(availability.endTime).getTime() - new Date(availability.startTime).getTime();
      return total + (duration / (1000 * 60 * 60)); // Convert to hours
    }, 0);

    const uniqueDays = new Set(
      availabilities.map(a => new Date(a.startTime).toDateString())
    ).size;

    res.json({
      success: true,
      data: {
        totalAvailabilities: availabilities.length,
        totalHours: Math.round(totalHours * 100) / 100,
        uniqueDays,
        period: period || 'all'
      }
    });
  } catch (error) {
    console.error('GET /availability/staff/:staffId/stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch availability statistics' 
    });
  }
});

export default router;
