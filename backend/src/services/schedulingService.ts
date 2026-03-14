import { addDays, startOfWeek, format, parseISO } from 'date-fns'
import prisma from '../lib/prisma'

export interface SchedulingException {
  ruleId: string
  ruleName: string
  dayOfWeek: string
  shiftType: 'day' | 'night'
  requiredStaff: number
  assignedStaff: number
  genderPreference: 'male' | 'female' | 'any'
  availableStaff: number
  message: string
  severity: 'warning' | 'error'
}

export interface GeneratedShift {
  id: string
  staffId: string
  staffName: string
  shiftType: 'day' | 'night'
  shiftName: string | null
  date: Date
  startTime: Date
  endTime: Date
  ruleId: string
  ruleName: string
}

export interface ScheduleResult {
  shifts: GeneratedShift[]
  exceptions: SchedulingException[]
  summary: {
    totalShifts: number
    totalExceptions: number
    weekStart: Date
    weekEnd: Date
  }
}

export async function generateSchedule(weekStart: string | Date, organizationId?: string): Promise<ScheduleResult> {
  const startDate = typeof weekStart === 'string' ? parseISO(weekStart) : weekStart
  const weekStartDate = startOfWeek(startDate, { weekStartsOn: 1 })
  const weekEndDate = addDays(weekStartDate, 6)

  const orgFilter = organizationId ? { organizationId } : {}

  // Idempotency: delete existing shifts and their working time transactions for this week
  const existingShifts = await prisma.shift.findMany({
    where: { date: { gte: weekStartDate, lte: weekEndDate }, ...orgFilter },
    select: { id: true }
  })
  const existingShiftIds = existingShifts.map(s => s.id)
  if (existingShiftIds.length > 0) {
    await prisma.workingTimeTransaction.deleteMany({
      where: { referenceType: 'SHIFT', referenceId: { in: existingShiftIds } }
    })
  }
  await prisma.shift.deleteMany({
    where: { date: { gte: weekStartDate, lte: weekEndDate }, ...orgFilter }
  })

  const exceptions: SchedulingException[] = []
  const generatedShifts: GeneratedShift[] = []

  try {
    const allStaff = await prisma.staff.findMany({ where: { isActive: true, ...orgFilter }, orderBy: { name: 'asc' } })

    // Fetch approved absences overlapping this week
    const approvedAbsences = await prisma.absence.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: weekEndDate },
        endDate: { gte: weekStartDate },
        ...orgFilter
      },
      select: { staffId: true, startDate: true, endDate: true }
    })

    // Fetch active shift preferences (via contracts → staff)
    const shiftPreferences = await prisma.shiftPreference.findMany({
      where: { isActive: true, ...(organizationId ? { contract: { staff: { organizationId } } } : {}) },
      select: { contractId: true, dayOfWeek: true, shiftType: true, preferenceType: true, contract: { select: { staffId: true } } }
    })

    const availabilities = await prisma.availability.findMany({
      where: {
        staffId: { in: allStaff.filter(s => s.staffType === 'temporary').map(s => s.id) },
        startTime: { lte: weekEndDate },
        endTime: { gte: weekStartDate }
      },
      include: { staff: true },
      orderBy: { startTime: 'asc' }
    })

    const rules = await prisma.rule.findMany({ where: { ...orgFilter }, orderBy: { priority: 'desc' } })

    if (rules.length === 0) {
      throw new Error('NO_RULES: No shift rules are configured. Please add rules before generating a schedule.')
    }

    // Fairness: count shifts from previous week
    const previousWeekStart = addDays(weekStartDate, -7)
    const previousWeekEnd = addDays(weekStartDate, -1)
    const previousShifts = await prisma.shift.findMany({
      where: { date: { gte: previousWeekStart, lte: previousWeekEnd }, ...orgFilter }
    })

    const staffShiftCounts = new Map<string, number>()
    allStaff.forEach(staff => {
      staffShiftCounts.set(staff.id, previousShifts.filter(s => s.staffId === staff.id).length)
    })

    // Track weekly hours assigned during this generation run
    const weeklyHoursMap = new Map<string, number>()

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const currentDate = addDays(weekStartDate, dayIndex)
      const dayName = format(currentDate, 'EEEE').toLowerCase() as any

      for (const shiftType of ['day', 'night'] as const) {
        const applicableRules = rules.filter(r => (r.dayOfWeek === dayName || r.dayOfWeek === 'everyday') && r.shiftType === shiftType)

        for (const rule of applicableRules) {
          const result = processShiftRule(
            rule, currentDate, shiftType, allStaff, availabilities, generatedShifts, staffShiftCounts, approvedAbsences, shiftPreferences, weeklyHoursMap
          )

          if (result.exception) {
            exceptions.push(result.exception)
          }

          if (result.shifts.length > 0) {
            generatedShifts.push(...result.shifts)
            result.shifts.forEach(shift => {
              staffShiftCounts.set(shift.staffId, (staffShiftCounts.get(shift.staffId) || 0) + 1)
              // Update weekly hours for next iterations
              const shiftDuration = (shift.endTime.getTime() - shift.startTime.getTime()) / (1000 * 60 * 60)
              weeklyHoursMap.set(shift.staffId, (weeklyHoursMap.get(shift.staffId) || 0) + shiftDuration)
            })
          }
        }
      }
    }

    const savedShifts = await saveShiftsToDatabase(generatedShifts, organizationId)
    const savedExceptions = await saveExceptionsToDatabase(exceptions, savedShifts, organizationId)
    await recordWorkingTimeForShifts(savedShifts, organizationId)

    return {
      shifts: savedShifts,
      exceptions: savedExceptions,
      summary: {
        totalShifts: savedShifts.length,
        totalExceptions: exceptions.length,
        weekStart: weekStartDate,
        weekEnd: weekEndDate
      }
    }
  } catch (error: any) {
    // Re-throw known user-facing errors as-is
    if (error?.message?.startsWith('NO_RULES:')) throw error
    console.error('Error generating schedule:', error)
    throw new Error('Failed to generate schedule')
  }
}

export async function getWeekSchedule(weekStart: string | Date, organizationId?: string): Promise<ScheduleResult> {
  const startDate = typeof weekStart === 'string' ? parseISO(weekStart) : weekStart
  const weekStartDate = startOfWeek(startDate, { weekStartsOn: 1 })
  const weekEndDate = addDays(weekStartDate, 6)

  const orgFilter = organizationId ? { organizationId } : {}

  const shifts = await prisma.shift.findMany({
    where: { date: { gte: weekStartDate, lte: weekEndDate }, ...orgFilter },
    include: { staff: true, rule: { select: { name: true } } },
    orderBy: { date: 'asc' }
  })

  const exceptions = await prisma.schedulingException.findMany({
    where: {
      shift: { date: { gte: weekStartDate, lte: weekEndDate } },
      ...orgFilter
    },
    include: { rule: true }
  })

  const mappedShifts: GeneratedShift[] = shifts.map(s => ({
    id: s.id,
    staffId: s.staffId,
    staffName: s.staff.name,
    shiftType: s.shiftType,
    shiftName: s.shiftName || null,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    ruleId: s.ruleId || '',
    ruleName: s.rule?.name || ''
  }))

  return {
    shifts: mappedShifts,
    exceptions: exceptions as any[],
    summary: {
      totalShifts: shifts.length,
      totalExceptions: exceptions.length,
      weekStart: weekStartDate,
      weekEnd: weekEndDate
    }
  }
}

function processShiftRule(
  rule: any,
  date: Date,
  shiftType: 'day' | 'night',
  allStaff: any[],
  availabilities: any[],
  existingShifts: GeneratedShift[],
  staffShiftCounts: Map<string, number>,
  approvedAbsences: Array<{ staffId: string; startDate: Date; endDate: Date }> = [],
  shiftPreferences: Array<{ dayOfWeek: string; shiftType: string; preferenceType: string; contract: { staffId: string } }> = [],
  weeklyHoursMap: Map<string, number> = new Map()
): { shifts: GeneratedShift[], exception?: SchedulingException } {
  const shifts: GeneratedShift[] = []

  // Build shift times from rule's startHour/endHour (or fall back to day/night defaults)
  const dateMs = date.getTime()
  const startHour: number = rule.startHour ?? (shiftType === 'day' ? 8 : 20)
  const endHour: number = rule.endHour ?? (shiftType === 'day' ? 20 : 8)

  const shiftStartTime = new Date(new Date(dateMs).setHours(startHour, 0, 0, 0))
  // If endHour <= startHour, the shift crosses midnight
  const endDateMs = endHour <= startHour ? dateMs + 86400000 : dateMs
  const shiftEndTime = new Date(new Date(endDateMs).setHours(endHour, 0, 0, 0))
  const shiftHours = (shiftEndTime.getTime() - shiftStartTime.getTime()) / (1000 * 60 * 60)

  const dateStr = format(date, 'yyyy-MM-dd')

  // Staff already assigned to any shift on this day
  const assignedOnDay = new Set(
    existingShifts
      .filter(s => format(s.date, 'yyyy-MM-dd') === dateStr)
      .map(s => s.staffId)
  )

  // Staff on approved absence on this date
  const absentOnDay = new Set(
    approvedAbsences
      .filter(a => a.startDate <= date && a.endDate >= date)
      .map(a => a.staffId)
  )

  const dayName = format(date, 'EEEE').toLowerCase()

  // Build preference maps for this day+shiftType
  const dayPrefs = shiftPreferences.filter(p => p.dayOfWeek === dayName && p.shiftType === shiftType)
  const unavailableStaff = new Set(
    dayPrefs.filter(p => p.preferenceType === 'UNAVAILABLE').map(p => p.contract.staffId)
  )
  const preferredStaff = new Set(
    dayPrefs.filter(p => p.preferenceType === 'PREFERRED').map(p => p.contract.staffId)
  )

  const requiredQuals: string[] = rule.requiredQualifications || []

  let eligibleStaff = allStaff.filter(staff => {
    if (rule.genderPreference !== 'any' && staff.gender !== rule.genderPreference) return false
    if (assignedOnDay.has(staff.id)) return false
    if (absentOnDay.has(staff.id)) return false
    if (unavailableStaff.has(staff.id)) return false
    if (requiredQuals.length > 0) {
      const staffQuals: string[] = staff.qualifications || []
      if (!requiredQuals.every(q => staffQuals.includes(q))) return false
    }
    // Respect max weekly hours limit
    if (staff.maxHoursPerWeek != null) {
      const hoursWorked = weeklyHoursMap.get(staff.id) || 0
      if (hoursWorked + shiftHours > staff.maxHoursPerWeek) return false
    }
    return true
  })

  // Check availability for temporary staff
  const availableStaff = eligibleStaff.filter(staff => {
    if (staff.staffType === 'permanent') return true
    return availabilities.some(a =>
      a.staffId === staff.id &&
      a.startTime <= shiftStartTime &&
      a.endTime >= shiftEndTime
    )
  })

  // Sort: PREFERRED first, then permanent, then by fewest prior shifts (fairness)
  availableStaff.sort((a, b) => {
    const aPreferred = preferredStaff.has(a.id) ? 0 : 1
    const bPreferred = preferredStaff.has(b.id) ? 0 : 1
    if (aPreferred !== bPreferred) return aPreferred - bPreferred
    if (a.staffType === 'permanent' && b.staffType === 'temporary') return -1
    if (a.staffType === 'temporary' && b.staffType === 'permanent') return 1
    return (staffShiftCounts.get(a.id) || 0) - (staffShiftCounts.get(b.id) || 0)
  })

  const staffToAssign = availableStaff.slice(0, rule.requiredStaff)

  for (const staff of staffToAssign) {
    shifts.push({
      id: '',
      staffId: staff.id,
      staffName: staff.name,
      shiftType,
      shiftName: rule.shiftName || null,
      date: new Date(dateMs),
      startTime: new Date(shiftStartTime),
      endTime: new Date(shiftEndTime),
      ruleId: rule.id,
      ruleName: rule.name
    })
  }

  if (staffToAssign.length < rule.requiredStaff) {
    const exception: SchedulingException = {
      ruleId: rule.id,
      ruleName: rule.name,
      dayOfWeek: format(date, 'EEEE'),
      shiftType,
      requiredStaff: rule.requiredStaff,
      assignedStaff: staffToAssign.length,
      genderPreference: rule.genderPreference,
      availableStaff: availableStaff.length,
      message: `Only ${staffToAssign.length} of ${rule.requiredStaff} required staff assigned for ${rule.name} (${format(date, 'EEEE')})`,
      severity: staffToAssign.length === 0 ? 'error' : 'warning'
    }
    return { shifts, exception }
  }

  return { shifts }
}

async function saveShiftsToDatabase(shifts: GeneratedShift[], organizationId?: string): Promise<GeneratedShift[]> {
  if (shifts.length === 0) return []

  const orgFilter = organizationId ? { organizationId } : {}

  await prisma.shift.createMany({
    data: shifts.map(s => ({
      staffId: s.staffId,
      ruleId: s.ruleId || null,
      shiftType: s.shiftType,
      shiftName: s.shiftName,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      ...orgFilter
    }))
  })

  // Fetch saved records to get assigned IDs
  const weekStart = shifts.reduce((min, s) => s.date < min ? s.date : min, shifts[0].date)
  const weekEnd = shifts.reduce((max, s) => s.date > max ? s.date : max, shifts[0].date)

  const saved = await prisma.shift.findMany({
    where: { date: { gte: weekStart, lte: weekEnd }, ...orgFilter },
    include: { staff: true },
    orderBy: { date: 'asc' }
  })

  return saved.map(s => {
    const original = shifts.find(o => o.staffId === s.staffId && o.date.getTime() === s.date.getTime() && o.shiftType === s.shiftType)
    return {
      id: s.id,
      staffId: s.staffId,
      staffName: s.staff.name,
      shiftType: s.shiftType,
      shiftName: s.shiftName || null,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      ruleId: original?.ruleId || '',
      ruleName: original?.ruleName || ''
    }
  })
}

async function saveExceptionsToDatabase(exceptions: SchedulingException[], shifts: GeneratedShift[], organizationId?: string): Promise<any[]> {
  if (exceptions.length === 0) return []

  const orgFilter = organizationId ? { organizationId } : {}
  const savedExceptions = []
  for (const exception of exceptions) {
    const relatedShift = shifts.find(s => s.ruleId === exception.ruleId && s.shiftType === exception.shiftType)
    const saved = await prisma.schedulingException.create({
      data: {
        shiftId: relatedShift?.id || null,
        ruleId: exception.ruleId,
        message: exception.message,
        ...orgFilter
      }
    })
    savedExceptions.push({
      ...exception,
      id: saved.id,
      isResolved: false,
      createdAt: saved.createdAt
    })
  }
  return savedExceptions
}

async function recordWorkingTimeForShifts(shifts: GeneratedShift[], organizationId?: string): Promise<void> {
  if (shifts.length === 0) return

  for (const shift of shifts) {
    const shiftDate = new Date(shift.date)
    const year = shiftDate.getFullYear()
    const month = shiftDate.getMonth() + 1

    // Compute actual shift duration in hours from start/end times
    const shiftHours = (shift.endTime.getTime() - shift.startTime.getTime()) / (1000 * 60 * 60)

    // Upsert FLEX_TIME account for this staff member / year / month
    const account = await prisma.workingTimeAccount.upsert({
      where: { staffId_accountType_year_month: { staffId: shift.staffId, accountType: 'FLEX_TIME', year, month } },
      create: { staffId: shift.staffId, accountType: 'FLEX_TIME', year, month, balance: 0, ...(organizationId ? { organizationId } : {}) },
      update: {}
    })

    // Record the shift as a CREDIT transaction
    await prisma.workingTimeTransaction.create({
      data: {
        accountId: account.id,
        transactionType: 'CREDIT',
        amount: shiftHours,
        description: `${shift.shiftType === 'day' ? 'Day' : 'Night'} shift on ${format(shiftDate, 'dd MMM yyyy')}`,
        referenceType: 'SHIFT',
        referenceId: shift.id,
        method: 'AUTOMATIC'
      }
    })

    // Update account balance
    await prisma.workingTimeAccount.update({
      where: { id: account.id },
      data: { balance: { increment: shiftHours } }
    })
  }
}

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}
