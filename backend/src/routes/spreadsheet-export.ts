import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { getWeekSchedule } from '../services/schedulingService';
import { generateRosterSpreadsheet, generateCSVRoster, AbsenceExportRow } from '../services/spreadsheetService';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { addDays, startOfWeek } from 'date-fns';

const router = Router();

router.use(authenticateToken, requireRole('admin', 'manager'));

// POST export roster as Excel (reads existing schedule, does not regenerate)
router.post('/excel', [
  body('weekStart').isISO8601().withMessage('Week start must be a valid ISO 8601 date')
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { weekStart } = req.body;
    const orgId = req.user!.organizationId;
    const weekStartDate = startOfWeek(new Date(weekStart), { weekStartsOn: 1 });
    const weekEndDate = addDays(weekStartDate, 6);

    const scheduleResult = await getWeekSchedule(weekStart, orgId);

    const absenceRecords = await prisma.absence.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: weekEndDate },
        endDate: { gte: weekStartDate },
        organizationId: orgId,
      },
      include: { staff: { select: { name: true } } },
      orderBy: { startDate: 'asc' },
    });

    const absences: AbsenceExportRow[] = absenceRecords.map(a => ({
      staffName: a.staff.name,
      absenceType: a.absenceType,
      startDate: a.startDate.toISOString(),
      endDate: a.endDate.toISOString(),
      status: a.status,
      reason: a.reason || undefined,
    }));

    const excelBuffer = generateRosterSpreadsheet(scheduleResult, absences);

    const fileName = `roster_${weekStartDate.toISOString().split('T')[0]}_to_${weekEndDate.toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', excelBuffer.length);
    res.send(excelBuffer);
  } catch (error) {
    console.error('POST /api/spreadsheet-export/excel error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate Excel file' });
  }
});

// POST export roster as CSV (reads existing schedule, does not regenerate)
router.post('/csv', [
  body('weekStart').isISO8601().withMessage('Week start must be a valid ISO 8601 date')
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { weekStart } = req.body;
    const orgId = req.user!.organizationId;
    const scheduleResult = await getWeekSchedule(weekStart, orgId);

    const csvContent = generateCSVRoster(scheduleResult);

    const weekStartDate = new Date(weekStart);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);

    const fileName = `roster_${weekStartDate.toISOString().split('T')[0]}_to_${weekEndDate.toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('POST /api/spreadsheet-export/csv error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate CSV file' });
  }
});

export default router;
