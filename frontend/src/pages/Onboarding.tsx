import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDays, addWeeks, format, parseISO, startOfWeek } from 'date-fns'
import { Building2, Users, BookOpen, Calendar, CheckCircle, Trash2, ChevronRight, ChevronLeft, Loader2, Download, UserPlus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { staffAPI, rulesAPI, schedulePlansAPI, spreadsheetExportAPI, orgSettingsAPI } from '@/lib/api'
import WeeklyScheduleView from '@/components/WeeklyScheduleView'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

type Gender = 'male' | 'female'
type StaffType = 'permanent' | 'temporary'
type ShiftType = 'day' | 'night'

interface StaffForm {
  id: string
  name: string
  gender: Gender
  staffType: StaffType
  maxHoursPerWeek: string
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
type DayKey = typeof DAYS[number]

const DAY_LABELS: Record<DayKey, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">Step {step} of {total}</span>
        <span className="text-sm text-gray-400">{Math.round((step / total) * 100)}%</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>
    </div>
  )
}

function Onboarding() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [step, setStep] = useState(1)
  const TOTAL_STEPS = 5

  // Step 1: Org setup
  const [orgForm, setOrgForm] = useState({
    orgName: '',
    timezone: 'UTC',
    dayShiftStart: 8,
    dayShiftEnd: 20,
    nightShiftStart: 20,
    nightShiftEnd: 8,
  })
  const [isSavingOrg, setIsSavingOrg] = useState(false)

  const handleSaveOrg = async () => {
    setIsSavingOrg(true)
    try {
      await orgSettingsAPI.update(orgForm)
      toast({ title: 'Organisation settings saved!' })
      setStep(2)
    } catch {
      toast({ title: 'Failed to save org settings', variant: 'destructive' })
    } finally {
      setIsSavingOrg(false)
    }
  }

  // Step 2: Add team
  const [_createdStaff, setCreatedStaff] = useState<{ id: string; name: string }[]>([])
  const [staffForms, setStaffForms] = useState<StaffForm[]>([])
  const [nameInput, setNameInput] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [rulesGrid, setRulesGrid] = useState<Record<DayKey, { day: number; night: number }>>({
    monday: { day: 0, night: 0 },
    tuesday: { day: 0, night: 0 },
    wednesday: { day: 0, night: 0 },
    thursday: { day: 0, night: 0 },
    friday: { day: 0, night: 0 },
    saturday: { day: 0, night: 0 },
    sunday: { day: 0, night: 0 },
  })
  const [scheduleStartDate, setScheduleStartDate] = useState(() =>
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  )
  const [scheduleWeeks, setScheduleWeeks] = useState(1)
  const [generatedWeek, setGeneratedWeek] = useState<Date | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCreatingStaff, setIsCreatingStaff] = useState(false)
  const [isCreatingRules, setIsCreatingRules] = useState(false)

  // Step 1: Add team
  const addStaffRow = () => {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    setStaffForms(prev => [...prev, { id: crypto.randomUUID(), name: trimmed, gender: 'male', staffType: 'permanent', maxHoursPerWeek: '' }])
    setNameInput('')
    nameInputRef.current?.focus()
  }

  const removeStaffRow = (id: string) => {
    setStaffForms(prev => prev.filter(r => r.id !== id))
  }

  const updateStaffRow = (id: string, field: keyof StaffForm, value: string) => {
    setStaffForms(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row))
  }

  const handleCreateStaff = async () => {
    setIsCreatingStaff(true)
    try {
      const results = await Promise.all(
        staffForms.map(s => staffAPI.create({
          name: s.name,
          gender: s.gender,
          staffType: s.staffType,
          maxHoursPerWeek: s.maxHoursPerWeek ? parseInt(s.maxHoursPerWeek) : null,
        }))
      )
      const created = results.map((r: any) => ({
        id: r.data.staff?.id || r.data.id,
        name: r.data.staff?.name || r.data.name,
      }))
      setCreatedStaff(created)
      toast({ title: `${created.length} staff member(s) added!` })
      setStep(3)
    } catch (error: any) {
      toast({
        title: 'Failed to create staff',
        description: error?.response?.data?.message || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsCreatingStaff(false)
    }
  }

  // Step 2: Shift rules
  const updateRulesGrid = (day: DayKey, shift: ShiftType, value: number) => {
    setRulesGrid(prev => ({
      ...prev,
      [day]: { ...prev[day], [shift]: value },
    }))
  }

  const handleCreateRules = async () => {
    setIsCreatingRules(true)
    try {
      const rulesToCreate: Array<{
        name: string
        dayOfWeek: DayKey
        shiftType: ShiftType
        requiredStaff: number
        genderPreference: 'male' | 'female' | 'any'
        priority: number
      }> = []

      for (const day of DAYS) {
        const { day: dayCount, night: nightCount } = rulesGrid[day]
        if (dayCount > 0) {
          rulesToCreate.push({
            name: `${DAY_LABELS[day]} Day`,
            dayOfWeek: day,
            shiftType: 'day',
            requiredStaff: dayCount,
            genderPreference: 'any',
            priority: 1,
          })
        }
        if (nightCount > 0) {
          rulesToCreate.push({
            name: `${DAY_LABELS[day]} Night`,
            dayOfWeek: day,
            shiftType: 'night',
            requiredStaff: nightCount,
            genderPreference: 'any',
            priority: 1,
          })
        }
      }

      if (rulesToCreate.length > 0) {
        // Clear existing rules to prevent duplicates from re-running onboarding
        await rulesAPI.deleteAll()
        await Promise.all(rulesToCreate.map(r => rulesAPI.create(r)))
        toast({ title: `${rulesToCreate.length} shift rule(s) created!` })
      } else {
        toast({ title: 'No rules to create — all counts are 0. Continuing.' })
      }
      setStep(4)
    } catch (error: any) {
      toast({
        title: 'Failed to create rules',
        description: error?.response?.data?.message || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsCreatingRules(false)
    }
  }

  // Step 3: Generate schedule — creates a named SchedulePlan so it appears on Dashboard
  const handleGenerateSchedule = async () => {
    setIsGenerating(true)
    try {
      const endDateStr = format(
        addDays(addWeeks(parseISO(scheduleStartDate), scheduleWeeks), -1),
        'yyyy-MM-dd'
      )
      const result = await schedulePlansAPI.create({
        name: 'Onboarding Schedule',
        startDate: scheduleStartDate,
        endDate: endDateStr,
      })
      const planWeekStart = result.data?.data?.plan?.weekStart
      setGeneratedWeek(planWeekStart ? parseISO(planWeekStart) : parseISO(scheduleStartDate))
      toast({ title: `Schedule generated for ${scheduleWeeks} week(s)!` })
      setStep(5)
    } catch (error: any) {
      toast({
        title: 'Failed to generate schedule',
        description: error?.response?.data?.message || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // Step 4: Export
  const handleExportExcel = async () => {
    if (!generatedWeek) return
    try {
      const weekStart = format(generatedWeek, 'yyyy-MM-dd')
      const response = await spreadsheetExportAPI.exportExcel(weekStart)
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `roster_${weekStart}_to_${format(addDays(generatedWeek, 6), 'yyyy-MM-dd')}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast({ title: 'Excel file downloaded!' })
    } catch (error) {
      toast({ title: 'Failed to export Excel file', variant: 'destructive' })
    }
  }

  const handleDone = () => {
    localStorage.setItem('onboarding_complete', 'true')
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-3xl mx-auto py-10 px-4">
        {/* Logo + skip */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <Building2 className="h-7 w-7 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">Socio</span>
          </div>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem('onboarding_complete', 'true')
              navigate('/')
            }}
            className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            Skip setup for now
          </button>
        </div>

        <ProgressBar step={step} total={TOTAL_STEPS} />

        {/* Step 1: Org Setup */}
        {step === 1 && (
          <Card className="shadow-md">
            <CardContent className="py-8 px-8">
              <div className="flex items-center gap-3 mb-2">
                <Building2 className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-900">Step 1 of {TOTAL_STEPS} — Organisation Setup</h2>
              </div>
              <p className="text-gray-500 text-sm mb-6">
                Set your organisation name and default shift hours. You can change these later in Organisation settings.
              </p>

              <div className="space-y-4 mb-8">
                <div>
                  <Label className="mb-1 block">Organisation Name</Label>
                  <Input
                    placeholder="e.g. Lifto Logistics"
                    value={orgForm.orgName}
                    onChange={e => setOrgForm(f => ({ ...f, orgName: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="mb-1 block">Timezone</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                    value={orgForm.timezone}
                    onChange={e => setOrgForm(f => ({ ...f, timezone: e.target.value }))}
                  >
                    {['UTC','Europe/London','Europe/Berlin','Europe/Paris','America/New_York','America/Chicago','America/Los_Angeles','Asia/Dubai','Asia/Kolkata'].map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1 block">Day shift start</Label>
                    <input type="number" min={0} max={23} value={orgForm.dayShiftStart}
                      onChange={e => setOrgForm(f => ({ ...f, dayShiftStart: parseInt(e.target.value) || 0 }))}
                      className="border rounded-md px-3 py-1.5 w-full text-sm" />
                  </div>
                  <div>
                    <Label className="mb-1 block">Day shift end</Label>
                    <input type="number" min={0} max={23} value={orgForm.dayShiftEnd}
                      onChange={e => setOrgForm(f => ({ ...f, dayShiftEnd: parseInt(e.target.value) || 0 }))}
                      className="border rounded-md px-3 py-1.5 w-full text-sm" />
                  </div>
                  <div>
                    <Label className="mb-1 block">Night shift start</Label>
                    <input type="number" min={0} max={23} value={orgForm.nightShiftStart}
                      onChange={e => setOrgForm(f => ({ ...f, nightShiftStart: parseInt(e.target.value) || 0 }))}
                      className="border rounded-md px-3 py-1.5 w-full text-sm" />
                  </div>
                  <div>
                    <Label className="mb-1 block">Night shift end</Label>
                    <input type="number" min={0} max={23} value={orgForm.nightShiftEnd}
                      onChange={e => setOrgForm(f => ({ ...f, nightShiftEnd: parseInt(e.target.value) || 0 }))}
                      className="border rounded-md px-3 py-1.5 w-full text-sm" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveOrg} disabled={isSavingOrg || !orgForm.orgName.trim()}>
                  {isSavingOrg ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <>Continue <ChevronRight className="h-4 w-4 ml-2" /></>}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Add Team */}
        {step === 2 && (
          <Card className="shadow-md">
            <CardContent className="py-8 px-8">
              <div className="flex items-center gap-3 mb-2">
                <Users className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-900">Step 2 of {TOTAL_STEPS} — Add Your Team</h2>
              </div>
              <p className="text-gray-500 text-sm mb-6">
                Type a name and press Enter (or click +) to add each team member.
              </p>

              {/* Name input row */}
              <div className="flex gap-2 mb-4">
                <Input
                  ref={nameInputRef}
                  placeholder="Enter full name…"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStaffRow() } }}
                  className="flex-1"
                  autoFocus
                />
                <Button
                  type="button"
                  onClick={addStaffRow}
                  disabled={!nameInput.trim()}
                  variant="outline"
                  className="shrink-0"
                >
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Add
                </Button>
              </div>

              {/* Staff table */}
              {staffForms.length > 0 ? (
                <div className="border rounded-lg overflow-hidden mb-6">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">#</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Name</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Gender</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Type</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Max hrs/wk</th>
                        <th className="px-2 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {staffForms.map((row, idx) => (
                        <tr key={row.id} className={cn('border-b last:border-0', idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')}>
                          <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{idx + 1}</td>
                          <td className="px-4 py-2.5">
                            <Input
                              value={row.name}
                              onChange={e => updateStaffRow(row.id, 'name', e.target.value)}
                              className="h-8 text-sm border-0 shadow-none focus-visible:ring-1 focus-visible:ring-blue-300 bg-transparent"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <select
                              className="border rounded px-2 py-1 text-sm bg-white h-8"
                              value={row.gender}
                              onChange={e => updateStaffRow(row.id, 'gender', e.target.value)}
                            >
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                            </select>
                          </td>
                          <td className="px-4 py-2.5">
                            <select
                              className="border rounded px-2 py-1 text-sm bg-white h-8"
                              value={row.staffType}
                              onChange={e => updateStaffRow(row.id, 'staffType', e.target.value)}
                            >
                              <option value="permanent">Permanent</option>
                              <option value="temporary">Temporary</option>
                            </select>
                          </td>
                          <td className="px-4 py-2.5">
                            <Input
                              type="number"
                              min={1}
                              max={168}
                              value={row.maxHoursPerWeek}
                              onChange={e => updateStaffRow(row.id, 'maxHoursPerWeek', e.target.value)}
                              className="h-8 text-sm border-0 shadow-none focus-visible:ring-1 focus-visible:ring-blue-300 bg-transparent w-20"
                              placeholder="40"
                            />
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeStaffRow(row.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="bg-gray-50 px-4 py-2 text-xs text-gray-400 border-t">
                    {staffForms.length} {staffForms.length === 1 ? 'person' : 'people'} added
                  </div>
                </div>
              ) : (
                <div className="border border-dashed rounded-lg py-10 text-center text-gray-400 text-sm mb-6">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No team members yet — type a name above and press Enter
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="h-4 w-4 mr-2" />Back
                </Button>
                <Button
                  onClick={handleCreateStaff}
                  disabled={isCreatingStaff || staffForms.length === 0 || staffForms.some(s => !s.name.trim())}
                >
                  {isCreatingStaff ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                  ) : (
                    <>Continue <ChevronRight className="h-4 w-4 ml-2" /></>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Shift Rules */}
        {step === 3 && (
          <Card className="shadow-md">
            <CardContent className="py-8 px-8">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-gray-900">Step 3 of {TOTAL_STEPS} — Shift Rules</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 shrink-0"
                >
                  Skip for now
                </button>
              </div>
              <p className="text-gray-500 text-sm mb-6">
                Define how many staff you need for each shift. Leave at 0 to skip that slot.
              </p>

              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-gray-600">Day</th>
                      <th className="text-center py-2 px-4 font-medium text-gray-600">Day Shift (staff needed)</th>
                      <th className="text-center py-2 pl-4 font-medium text-gray-600">Night Shift (staff needed)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map(day => (
                      <tr key={day} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium text-gray-700">{DAY_LABELS[day]}</td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={rulesGrid[day].day}
                            onChange={e => updateRulesGrid(day, 'day', Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))}
                            className="border rounded-md px-3 py-1.5 w-20 text-center text-sm"
                          />
                        </td>
                        <td className="py-3 pl-4 text-center">
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={rulesGrid[day].night}
                            onChange={e => updateRulesGrid(day, 'night', Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))}
                            className="border rounded-md px-3 py-1.5 w-20 text-center text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ChevronLeft className="h-4 w-4 mr-2" />Back
                </Button>
                <Button onClick={handleCreateRules} disabled={isCreatingRules}>
                  {isCreatingRules ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Generate Schedule */}
        {step === 4 && (
          <Card className="shadow-md">
            <CardContent className="py-8 px-8">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-900">Step 4 of {TOTAL_STEPS} — Generate Schedule</h2>
              </div>
              <p className="text-gray-500 text-sm mb-6">
                Choose the period you want to schedule and generate the rota.
              </p>

              <div className="flex gap-4 mb-8">
                <div className="flex-1">
                  <Label htmlFor="startDate" className="mb-1 block">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={scheduleStartDate}
                    onChange={e => setScheduleStartDate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="weeksSelect" className="mb-1 block">Weeks to schedule</Label>
                  <select
                    id="weeksSelect"
                    className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                    value={scheduleWeeks}
                    onChange={e => setScheduleWeeks(parseInt(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(w => (
                      <option key={w} value={w}>{w} {w === 1 ? 'week' : 'weeks'}</option>
                    ))}
                  </select>
                </div>
              </div>

              <Button
                className="w-full mb-4"
                onClick={handleGenerateSchedule}
                disabled={isGenerating || !scheduleStartDate}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    Generate Schedule
                  </>
                )}
              </Button>

              <div className="flex justify-start">
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ChevronLeft className="h-4 w-4 mr-2" />Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Review & Export */}
        {step === 5 && (
          <div>
            <Card className="shadow-md mb-6">
              <CardContent className="py-8 px-8">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <h2 className="text-xl font-bold text-gray-900">Step 5 of {TOTAL_STEPS} — Review & Export</h2>
                  </div>
                  <Button onClick={handleDone}>
                    Done — Go to Dashboard
                  </Button>
                </div>
                <p className="text-gray-500 text-sm mb-6">
                  Your schedule has been generated. Drag shifts to adjust, then export.
                </p>
                <Button variant="outline" onClick={handleExportExcel}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </CardContent>
            </Card>
            <WeeklyScheduleView weekStart={generatedWeek || undefined} />
          </div>
        )}
      </div>
    </div>
  )
}

export default Onboarding
