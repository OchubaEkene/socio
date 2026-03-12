import { Router, Response } from 'express';
import { startOfMonth, endOfMonth, subMonths, differenceInHours } from 'date-fns';
import prisma from '../lib/prisma';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// All reports require auth + manager/admin
router.use(authenticateToken, requireRole('admin', 'manager'));

// GET monthly summary report
router.get('/monthly', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.query;
    const targetDate = month && year
      ? new Date(parseInt(year as string), parseInt(month as string) - 1, 1)
      : new Date();

    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);

    const [shifts, unresolvedExceptions, pendingAbsences, approvedAbsences, pendingVacations] = await Promise.all([
      prisma.shift.findMany({
        where: { date: { gte: monthStart, lte: monthEnd } },
        include: { staff: { select: { id: true, name: true, staffType: true } } },
        orderBy: { date: 'asc' }
      }),
      prisma.schedulingException.count({ where: { isResolved: false } }),
      prisma.absence.count({ where: { status: 'PENDING' } }),
      prisma.absence.count({ where: { status: 'APPROVED', startDate: { gte: monthStart }, endDate: { lte: monthEnd } } }),
      prisma.vacationRequest.count({ where: { status: 'PENDING' } }),
    ]);

    const staffHours = new Map<string, { name: string; hours: number; dayShifts: number; nightShifts: number; staffType: string }>();

    shifts.forEach(shift => {
      const hours = differenceInHours(shift.endTime, shift.startTime);
      if (!staffHours.has(shift.staffId)) {
        staffHours.set(shift.staffId, { name: shift.staff.name, hours: 0, dayShifts: 0, nightShifts: 0, staffType: shift.staff.staffType });
      }
      const data = staffHours.get(shift.staffId)!;
      data.hours += hours;
      shift.shiftType === 'day' ? data.dayShifts++ : data.nightShifts++;
    });

    const dayShifts = shifts.filter(s => s.shiftType === 'day').length;
    const nightShifts = shifts.filter(s => s.shiftType === 'night').length;
    const totalHours = Array.from(staffHours.values()).reduce((sum, s) => sum + s.hours, 0);

    const staffPerformance = Array.from(staffHours.values())
      .map(s => ({ ...s, totalShifts: s.dayShifts + s.nightShifts, averageHoursPerShift: (s.dayShifts + s.nightShifts) > 0 ? (s.hours / (s.dayShifts + s.nightShifts)).toFixed(1) : '0' }))
      .sort((a, b) => b.hours - a.hours);

    res.json({
      success: true,
      data: {
        period: { start: monthStart, end: monthEnd, month: monthStart.getMonth() + 1, year: monthStart.getFullYear() },
        summary: { totalShifts: shifts.length, totalHours, dayShifts, nightShifts, unresolvedExceptions, totalStaff: staffHours.size, pendingAbsences, approvedAbsences, pendingVacations },
        staffPerformance,
        shiftDistribution: { day: dayShifts, night: nightShifts, total: shifts.length }
      }
    });
  } catch (error) {
    console.error('GET /reports/monthly error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate monthly report' });
  }
});

// GET staff performance for specific staff member
router.get('/staff-performance/:staffId', async (req: AuthRequest, res: Response) => {
  try {
    const { staffId } = req.params;
    const { month, year } = req.query;
    const targetDate = month && year
      ? new Date(parseInt(year as string), parseInt(month as string) - 1, 1)
      : new Date();

    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, name: true, staffType: true, qualifications: true }
    });

    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found' });

    const previousMonthStart = startOfMonth(subMonths(targetDate, 1));
    const previousMonthEnd = endOfMonth(subMonths(targetDate, 1));

    const [shifts, previousMonthShifts] = await Promise.all([
      prisma.shift.findMany({ where: { staffId, date: { gte: monthStart, lte: monthEnd } }, orderBy: { date: 'asc' } }),
      prisma.shift.findMany({ where: { staffId, date: { gte: previousMonthStart, lte: previousMonthEnd } } })
    ]);

    const totalHours = shifts.reduce((sum, s) => sum + differenceInHours(s.endTime, s.startTime), 0);
    const previousMonthHours = previousMonthShifts.reduce((sum, s) => sum + differenceInHours(s.endTime, s.startTime), 0);
    const dayShifts = shifts.filter(s => s.shiftType === 'day').length;
    const nightShifts = shifts.filter(s => s.shiftType === 'night').length;
    const hoursChange = previousMonthHours > 0
      ? ((totalHours - previousMonthHours) / previousMonthHours * 100).toFixed(1)
      : '0';

    res.json({
      success: true,
      data: {
        staff,
        period: { start: monthStart, end: monthEnd, month: monthStart.getMonth() + 1, year: monthStart.getFullYear() },
        performance: {
          totalShifts: shifts.length, totalHours, dayShifts, nightShifts,
          averageHoursPerShift: shifts.length > 0 ? (totalHours / shifts.length).toFixed(1) : '0',
          hoursChange: `${hoursChange}%`,
          shiftDetails: shifts.map(s => ({ id: s.id, date: s.date, shiftType: s.shiftType, startTime: s.startTime, endTime: s.endTime, hours: differenceInHours(s.endTime, s.startTime) }))
        }
      }
    });
  } catch (error) {
    console.error('GET /reports/staff-performance/:staffId error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate staff performance report' });
  }
});

// GET shift distribution report
router.get('/shift-distribution', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.query;
    const targetDate = month && year
      ? new Date(parseInt(year as string), parseInt(month as string) - 1, 1)
      : new Date();

    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);

    const shifts = await prisma.shift.findMany({
      where: { date: { gte: monthStart, lte: monthEnd } },
      include: { staff: { select: { id: true, name: true, staffType: true } } },
      orderBy: { date: 'asc' }
    });

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayDistribution = new Map(daysOfWeek.map(d => [d, { day: 0, night: 0, total: 0 }]));

    const staffTypeDistribution = {
      permanent: { day: 0, night: 0, total: 0 },
      temporary: { day: 0, night: 0, total: 0 }
    };

    shifts.forEach(shift => {
      const dayData = dayDistribution.get(daysOfWeek[shift.date.getDay()])!;
      shift.shiftType === 'day' ? dayData.day++ : dayData.night++;
      dayData.total++;

      const typeData = staffTypeDistribution[shift.staff.staffType];
      shift.shiftType === 'day' ? typeData.day++ : typeData.night++;
      typeData.total++;
    });

    res.json({
      success: true,
      data: {
        period: { start: monthStart, end: monthEnd, month: monthStart.getMonth() + 1, year: monthStart.getFullYear() },
        summary: { totalShifts: shifts.length, dayShifts: shifts.filter(s => s.shiftType === 'day').length, nightShifts: shifts.filter(s => s.shiftType === 'night').length },
        dayDistribution: Array.from(dayDistribution.entries()).map(([dayName, data]) => ({ dayName, ...data })),
        staffTypeDistribution
      }
    });
  } catch (error) {
    console.error('GET /reports/shift-distribution error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate shift distribution report' });
  }
});

export default router;
