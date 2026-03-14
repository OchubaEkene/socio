import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticateToken, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticateToken)

// GET org settings (auto-creates singleton if missing)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user!.organizationId ?? 'default-org'
    const settings = await prisma.orgSettings.upsert({
      where: { id: orgId },
      update: {},
      create: { id: orgId },
    })
    res.json({ success: true, data: settings })
  } catch (error) {
    console.error('GET /org-settings error:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch org settings' })
  }
})

// PUT org settings
router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user!.organizationId ?? 'default-org'
    const {
      orgName, timezone,
      dayShiftStart, dayShiftEnd,
      nightShiftStart, nightShiftEnd,
      defaultDayStaff, defaultNightStaff,
      syncRulesToDefaults, // explicit opt-in to overwrite all rules
    } = req.body

    const settings = await prisma.orgSettings.upsert({
      where: { id: orgId },
      update: {
        ...(orgName !== undefined && { orgName }),
        ...(timezone !== undefined && { timezone }),
        ...(dayShiftStart !== undefined && { dayShiftStart: Number(dayShiftStart) }),
        ...(dayShiftEnd !== undefined && { dayShiftEnd: Number(dayShiftEnd) }),
        ...(nightShiftStart !== undefined && { nightShiftStart: Number(nightShiftStart) }),
        ...(nightShiftEnd !== undefined && { nightShiftEnd: Number(nightShiftEnd) }),
        ...(defaultDayStaff !== undefined && { defaultDayStaff: Number(defaultDayStaff) }),
        ...(defaultNightStaff !== undefined && { defaultNightStaff: Number(defaultNightStaff) }),
      },
      create: { id: orgId },
    })

    // Only sync defaults to rules when explicitly requested
    if (syncRulesToDefaults) {
      if (defaultDayStaff !== undefined) {
        await prisma.rule.updateMany({ where: { shiftType: 'day', organizationId: orgId }, data: { requiredStaff: Number(defaultDayStaff) } })
      }
      if (defaultNightStaff !== undefined) {
        await prisma.rule.updateMany({ where: { shiftType: 'night', organizationId: orgId }, data: { requiredStaff: Number(defaultNightStaff) } })
      }
      if (dayShiftStart !== undefined || dayShiftEnd !== undefined) {
        const dayUpdate: any = {}
        if (dayShiftStart !== undefined) dayUpdate.startHour = Number(dayShiftStart)
        if (dayShiftEnd !== undefined) dayUpdate.endHour = Number(dayShiftEnd)
        await prisma.rule.updateMany({ where: { shiftType: 'day', organizationId: orgId }, data: dayUpdate })
      }
      if (nightShiftStart !== undefined || nightShiftEnd !== undefined) {
        const nightUpdate: any = {}
        if (nightShiftStart !== undefined) nightUpdate.startHour = Number(nightShiftStart)
        if (nightShiftEnd !== undefined) nightUpdate.endHour = Number(nightShiftEnd)
        await prisma.rule.updateMany({ where: { shiftType: 'night', organizationId: orgId }, data: nightUpdate })
      }
    }

    res.json({ success: true, data: settings })
  } catch (error) {
    console.error('PUT /org-settings error:', error)
    res.status(500).json({ success: false, message: 'Failed to update org settings' })
  }
})

export default router
