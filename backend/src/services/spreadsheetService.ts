import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';

import { GeneratedShift, ScheduleResult } from './schedulingService';

export interface ShiftData {
  id: string;
  staffId: string;
  staffName: string;
  shiftType: 'day' | 'night';
  date: string;
  startTime: string;
  endTime: string;
  ruleId: string;
  ruleName: string;
}

export interface ScheduleSummary {
  totalShifts: number;
  totalExceptions: number;
  weekStart: string;
  weekEnd: string;
}

export interface ScheduleData {
  shifts: ShiftData[];
  exceptions: any[];
  summary: ScheduleSummary;
}

// Convert ScheduleResult to ScheduleData
function convertScheduleResult(scheduleResult: ScheduleResult): ScheduleData {
  return {
    shifts: scheduleResult.shifts.map(shift => ({
      id: shift.id,
      staffId: shift.staffId,
      staffName: shift.staffName,
      shiftType: shift.shiftType,
      date: shift.date.toISOString(),
      startTime: shift.startTime.toISOString(),
      endTime: shift.endTime.toISOString(),
      ruleId: shift.ruleId,
      ruleName: shift.ruleName
    })),
    exceptions: scheduleResult.exceptions,
    summary: {
      totalShifts: scheduleResult.summary.totalShifts,
      totalExceptions: scheduleResult.summary.totalExceptions,
      weekStart: scheduleResult.summary.weekStart.toISOString(),
      weekEnd: scheduleResult.summary.weekEnd.toISOString()
    }
  };
}

export interface AbsenceExportRow {
  staffName: string;
  absenceType: string;
  startDate: string;
  endDate: string;
  status: string;
  reason?: string;
}

export function generateRosterSpreadsheet(scheduleResult: ScheduleResult, absences: AbsenceExportRow[] = []): Buffer {
  const scheduleData = convertScheduleResult(scheduleResult);
  const workbook = XLSX.utils.book_new();
  
  // Create the main roster sheet
  const rosterData = scheduleData.shifts.map(shift => ({
    'Date': format(parseISO(shift.date), 'EEEE, MMM d, yyyy'),
    'Day of Week': format(parseISO(shift.date), 'EEEE'),
    'Staff Name': shift.staffName,
    'Shift Type': shift.shiftType.charAt(0).toUpperCase() + shift.shiftType.slice(1),
    'Start Time': format(parseISO(shift.startTime), 'HH:mm'),
    'End Time': format(parseISO(shift.endTime), 'HH:mm'),
    'Duration (Hours)': calculateDuration(shift.startTime, shift.endTime),
    'Rule Applied': shift.ruleName
  }));

  const rosterSheet = XLSX.utils.json_to_sheet(rosterData);
  XLSX.utils.book_append_sheet(workbook, rosterSheet, 'Weekly Roster');

  // Create a summary sheet
  const summaryData = [
    { 'Metric': 'Total Shifts', 'Value': scheduleData.summary.totalShifts },
    { 'Metric': 'Total Exceptions', 'Value': scheduleData.summary.totalExceptions },
    { 'Metric': 'Week Start', 'Value': format(parseISO(scheduleData.summary.weekStart), 'EEEE, MMM d, yyyy') },
    { 'Metric': 'Week End', 'Value': format(parseISO(scheduleData.summary.weekEnd), 'EEEE, MMM d, yyyy') },
    { 'Metric': 'Generated On', 'Value': format(new Date(), 'EEEE, MMM d, yyyy HH:mm') }
  ];

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Create a staff summary sheet
  const staffSummary = generateStaffSummary(scheduleData.shifts);
  const staffSheet = XLSX.utils.json_to_sheet(staffSummary);
  XLSX.utils.book_append_sheet(workbook, staffSheet, 'Staff Summary');

  // Create a daily breakdown sheet
  const dailyBreakdown = generateDailyBreakdown(scheduleData.shifts);
  const dailySheet = XLSX.utils.json_to_sheet(dailyBreakdown);
  XLSX.utils.book_append_sheet(workbook, dailySheet, 'Daily Breakdown');

  // Absences sheet (only if data provided)
  if (absences.length > 0) {
    const absenceSheet = XLSX.utils.json_to_sheet(absences.map(a => ({
      'Staff Name': a.staffName,
      'Absence Type': a.absenceType,
      'Start Date': format(parseISO(a.startDate), 'EEEE, MMM d, yyyy'),
      'End Date': format(parseISO(a.endDate), 'EEEE, MMM d, yyyy'),
      'Status': a.status,
      'Reason': a.reason || '',
    })));
    XLSX.utils.book_append_sheet(workbook, absenceSheet, 'Absences');
  }

  // Generate the Excel file as a buffer
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return excelBuffer;
}

export function generateCSVRoster(scheduleResult: ScheduleResult): string {
  const scheduleData = convertScheduleResult(scheduleResult);

  const escape = (v: string | number) => {
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }

  const sorted = [...scheduleData.shifts].sort((a, b) => {
    const dateDiff = a.date.localeCompare(b.date)
    if (dateDiff !== 0) return dateDiff
    // day before night
    if (a.shiftType === b.shiftType) return a.staffName.localeCompare(b.staffName)
    return a.shiftType === 'day' ? -1 : 1
  })

  const headers = ['Date', 'Day', 'Staff', 'Shift', 'Start', 'End', 'Hours', 'Rule']
  const rows = [headers.join(',')]

  for (const shift of sorted) {
    rows.push([
      escape(format(parseISO(shift.date), 'yyyy-MM-dd')),
      escape(format(parseISO(shift.date), 'EEEE')),
      escape(shift.staffName),
      escape(shift.shiftType === 'day' ? 'Day' : 'Night'),
      escape(format(parseISO(shift.startTime), 'HH:mm')),
      escape(format(parseISO(shift.endTime), 'HH:mm')),
      escape(calculateDuration(shift.startTime, shift.endTime)),
      escape(shift.ruleName || ''),
    ].join(','))
  }

  // BOM for Excel UTF-8 compatibility
  return '\uFEFF' + rows.join('\r\n')
}

function calculateDuration(startTime: string, endTime: string): number {
  const start = parseISO(startTime);
  const end = parseISO(endTime);
  const diffInHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return Math.round(diffInHours * 100) / 100; // Round to 2 decimal places
}

function generateStaffSummary(shifts: ShiftData[]): any[] {
  const staffMap = new Map<string, { name: string; dayShifts: number; nightShifts: number; totalHours: number }>();
  
  shifts.forEach(shift => {
    const duration = calculateDuration(shift.startTime, shift.endTime);
    const existing = staffMap.get(shift.staffId) || { 
      name: shift.staffName, 
      dayShifts: 0, 
      nightShifts: 0, 
      totalHours: 0 
    };
    
    if (shift.shiftType === 'day') {
      existing.dayShifts++;
    } else {
      existing.nightShifts++;
    }
    existing.totalHours += duration;
    
    staffMap.set(shift.staffId, existing);
  });

  return Array.from(staffMap.values()).map(staff => ({
    'Staff Name': staff.name,
    'Day Shifts': staff.dayShifts,
    'Night Shifts': staff.nightShifts,
    'Total Shifts': staff.dayShifts + staff.nightShifts,
    'Total Hours': staff.totalHours
  }));
}

function generateDailyBreakdown(shifts: ShiftData[]): any[] {
  const dailyMap = new Map<string, { 
    date: string; 
    day: string; 
    dayStaff: string[]; 
    nightStaff: string[]; 
    dayCount: number; 
    nightCount: number 
  }>();
  
  shifts.forEach(shift => {
    const dateKey = format(parseISO(shift.date), 'yyyy-MM-dd');
    const existing = dailyMap.get(dateKey) || { 
      date: format(parseISO(shift.date), 'EEEE, MMM d, yyyy'),
      day: format(parseISO(shift.date), 'EEEE'),
      dayStaff: [],
      nightStaff: [],
      dayCount: 0,
      nightCount: 0
    };
    
    if (shift.shiftType === 'day') {
      existing.dayStaff.push(shift.staffName);
      existing.dayCount++;
    } else {
      existing.nightStaff.push(shift.staffName);
      existing.nightCount++;
    }
    
    dailyMap.set(dateKey, existing);
  });

  return Array.from(dailyMap.values()).map(day => ({
    'Date': day.date,
    'Day': day.day,
    'Day Staff Count': day.dayCount,
    'Day Staff': day.dayStaff.join(', '),
    'Night Staff Count': day.nightCount,
    'Night Staff': day.nightStaff.join(', '),
    'Total Staff': day.dayCount + day.nightCount
  }));
}
