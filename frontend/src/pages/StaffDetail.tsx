import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { staffAPI, absencesAPI, availabilityAPI } from '@/lib/api'
import {
  format, startOfWeek, addDays, isSameDay, startOfDay, addHours
} from 'date-fns'
import {
  ArrowLeft, Edit, User, Calendar, ClipboardList, Clock, ChevronLeft,
  ChevronRight, Check, Loader, Trash2, Plus
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

type Tab = 'availability' | 'shifts' | 'absences'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Build a full-day availability record covering both day and night shifts
function makeAvailabilityRecord(date: Date) {
  const start = startOfDay(date)               // 00:00
  const end = addHours(startOfDay(addDays(date, 1)), 9) // next day 09:00
  return { startTime: start.toISOString(), endTime: end.toISOString() }
}

function StaffDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<Tab>('availability')
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<{ name: string; email: string; gender: 'male' | 'female'; staffType: 'permanent' | 'temporary'; maxHoursPerWeek: string }>({ name: '', email: '', gender: 'male', staffType: 'permanent', maxHoursPerWeek: '' })
  const [availWeek, setAvailWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))

  // ── Staff data ──
  const { data: staffRes, isLoading, error } = useQuery({
    queryKey: ['staff', id],
    queryFn: () => staffAPI.getById(id!),
    enabled: !!id,
  })
  const staff = staffRes?.data?.staff || staffRes?.data

  // ── Shifts for current month ──
  const monthStart = startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const monthEnd = startOfDay(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))
  const { data: shiftsRes } = useQuery({
    queryKey: ['staff-shifts', id],
    queryFn: () => staffAPI.getShifts(id!, {
      startDate: monthStart.toISOString(),
      endDate: monthEnd.toISOString()
    }),
    enabled: !!id && activeTab === 'shifts',
  })
  const shifts: any[] = shiftsRes?.data?.shifts || []

  // ── Absences ──
  const { data: absencesRes } = useQuery({
    queryKey: ['staff-absences', id],
    queryFn: () => absencesAPI.getAll({ staffId: id }),
    enabled: !!id && activeTab === 'absences',
  })
  const absences: any[] = absencesRes?.data?.data?.absences || absencesRes?.data?.absences || []

  // ── Availability for selected week ──
  const { data: availRes, isFetching: availLoading } = useQuery({
    queryKey: ['staff-availability', id, availWeek.toISOString()],
    queryFn: () => availabilityAPI.getByStaff(id!, availWeek.toISOString()),
    enabled: !!id && activeTab === 'availability',
  })
  const availabilities: any[] = availRes?.data?.data?.availabilities || []

  // For each weekday, check if an availability record exists
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(availWeek, i))
  const availForDay = (day: Date) =>
    availabilities.find(a => isSameDay(new Date(a.startTime), day))

  // ── Mutations ──
  const addAvail = useMutation({
    mutationFn: (date: Date) => availabilityAPI.addSingle(id!, makeAvailabilityRecord(date)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-availability', id] }),
    onError: () => toast({ title: 'Failed to add availability', variant: 'destructive' }),
  })

  const removeAvail = useMutation({
    mutationFn: (availId: string) => availabilityAPI.delete(availId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-availability', id] }),
    onError: () => toast({ title: 'Failed to remove availability', variant: 'destructive' }),
  })

  const updateStaff = useMutation({
    mutationFn: () => staffAPI.update(id!, {
      ...editForm,
      maxHoursPerWeek: editForm.maxHoursPerWeek ? parseInt(editForm.maxHoursPerWeek) : null,
    }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['staff', id] })
      setEditOpen(false)
      toast({ title: 'Staff updated' })
    },
    onError: () => toast({ title: 'Failed to update staff', variant: 'destructive' }),
  })

  // Open edit modal with current values
  const openEdit = () => {
    if (staff) {
      setEditForm({
        name: staff.name || '',
        email: staff.email || '',
        gender: staff.gender || 'male',
        staffType: staff.staffType || 'permanent',
        maxHoursPerWeek: staff.maxHoursPerWeek != null ? String(staff.maxHoursPerWeek) : '',
      })
    }
    setEditOpen(true)
  }

  if (isLoading) {
    return (
      <div className="section-spacing">
        <div className="flex items-center justify-center py-24">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (error || !staff) {
    return (
      <div className="section-spacing">
        <Card>
          <CardContent className="pt-10 pb-10 text-center">
            <p className="font-medium mb-4">Staff member not found.</p>
            <Button onClick={() => navigate('/staff')}>Back to Staff</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="section-spacing">

      {/* ── Header ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/staff')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>{staff.name}</CardTitle>
                <CardDescription>
                  {staff.email || 'No email'} · Joined {format(new Date(staff.createdAt), 'MMM d, yyyy')}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={staff.staffType === 'permanent' ? 'default' : 'secondary'} className="capitalize">
                {staff.staffType}
              </Badge>
              <Badge variant="outline" className="capitalize">{staff.gender}</Badge>
              {staff.maxHoursPerWeek != null && (
                <Badge variant="outline">{staff.maxHoursPerWeek}h/wk max</Badge>
              )}
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Edit className="h-4 w-4 mr-2" />Edit
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b">
        {([
          { id: 'availability', label: 'Availability', icon: Calendar },
          { id: 'shifts', label: 'Shifts', icon: Clock },
          { id: 'absences', label: 'Absences', icon: ClipboardList },
        ] as { id: Tab; label: string; icon: any }[]).map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Availability Tab ── */}
      {activeTab === 'availability' && (
        <div className="space-y-4">
          {/* Week nav */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle>Weekly Availability</CardTitle>
                  <CardDescription>
                    Toggle which days {staff.name} is available to work.
                    {staff.staffType === 'permanent' && (
                      <span className="text-orange-600 ml-1">
                        Permanent staff are always scheduled regardless.
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="icon" onClick={() => setAvailWeek(w => addDays(w, -7))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-semibold min-w-[170px] text-center">
                    {format(availWeek, 'MMM d')} – {format(addDays(availWeek, 6), 'MMM d, yyyy')}
                  </span>
                  <Button variant="outline" size="icon" onClick={() => setAvailWeek(w => addDays(w, 7))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setAvailWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
                    Today
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Day cards — responsive: 2 cols on mobile, 4 on md, 7 on xl */}
          {availLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-4">
              {weekDays.map((day, i) => {
                const record = availForDay(day)
                const isAvailable = !!record
                const isToday = isSameDay(day, new Date())
                const isPast = day < startOfDay(new Date())

                return (
                  <div
                    key={i}
                    className={cn(
                      'flex flex-col rounded-2xl border-2 transition-all overflow-hidden',
                      isAvailable
                        ? 'border-primary shadow-md shadow-primary/10'
                        : 'border-border',
                      isToday && 'ring-2 ring-primary/40 ring-offset-2',
                    )}
                  >
                    {/* Top colour bar */}
                    <div className={cn(
                      'h-2 w-full',
                      isAvailable ? 'bg-primary' : 'bg-muted',
                    )} />

                    <div className="flex flex-col items-center gap-4 p-5">
                      {/* Day name + number */}
                      <div className="text-center">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                          {DAYS[i]}
                        </p>
                        <p className={cn(
                          'text-4xl font-bold leading-none',
                          isToday ? 'text-primary' : 'text-foreground',
                        )}>
                          {format(day, 'd')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(day, 'MMM')}
                        </p>
                      </div>

                      {/* Status badge */}
                      <div className={cn(
                        'w-full text-center py-1.5 rounded-lg text-xs font-semibold',
                        isAvailable
                          ? 'bg-primary/10 text-primary'
                          : isPast
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-muted/50 text-muted-foreground',
                      )}>
                        {isAvailable ? '✓ Available' : isPast ? 'Past' : 'Unavailable'}
                      </div>

                      {/* Action button */}
                      {isAvailable ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 h-9"
                          onClick={() => removeAvail.mutate(record.id)}
                          disabled={removeAvail.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Remove
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-9"
                          onClick={() => addAvail.mutate(day)}
                          disabled={addAvail.isPending || isPast}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Set Available
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Bulk actions */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground">Quick actions:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const toAdd = weekDays.filter(d => !availForDay(d) && d >= startOfDay(new Date()))
                    toAdd.forEach(d => addAvail.mutate(d))
                  }}
                  disabled={addAvail.isPending}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Mark all available
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => availabilities.forEach(a => removeAvail.mutate(a.id))}
                  disabled={removeAvail.isPending || availabilities.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear week
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Shifts Tab ── */}
      {activeTab === 'shifts' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shifts — {format(new Date(), 'MMMM yyyy')}</CardTitle>
          </CardHeader>
          <CardContent>
            {shifts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No shifts this month.</p>
            ) : (
              <div className="space-y-2">
                {shifts.map((shift: any) => (
                  <div key={shift.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{format(new Date(shift.date), 'EEE, MMM d')}</p>
                      {shift.shiftName && (
                        <p className="text-xs text-muted-foreground">{shift.shiftName}</p>
                      )}
                    </div>
                    <Badge variant={shift.shiftType === 'day' ? 'default' : 'secondary'} className="capitalize">
                      {shift.shiftType}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Absences Tab ── */}
      {activeTab === 'absences' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Absence History</CardTitle>
          </CardHeader>
          <CardContent>
            {absences.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No absences recorded.</p>
            ) : (
              <div className="space-y-2">
                {absences.map((absence: any) => (
                  <div key={absence.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {absence.absenceType?.toLowerCase().replace('_', ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(absence.startDate), 'MMM d')} – {format(new Date(absence.endDate), 'MMM d, yyyy')}
                      </p>
                      {absence.reason && (
                        <p className="text-xs text-muted-foreground mt-0.5">{absence.reason}</p>
                      )}
                    </div>
                    <Badge
                      variant={
                        absence.status === 'APPROVED' ? 'default' :
                        absence.status === 'REJECTED' ? 'destructive' : 'secondary'
                      }
                      className="capitalize"
                    >
                      {absence.status?.toLowerCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Edit Modal ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>Update {staff.name}'s details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={editForm.gender} onValueChange={v => setEditForm(f => ({ ...f, gender: v as 'male' | 'female' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Staff Type</Label>
              <Select value={editForm.staffType} onValueChange={v => setEditForm(f => ({ ...f, staffType: v as 'permanent' | 'temporary' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="permanent">Permanent</SelectItem>
                  <SelectItem value="temporary">Temporary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Max Hours / Week</Label>
              <Input
                type="number"
                min={1}
                max={168}
                placeholder="No limit"
                value={editForm.maxHoursPerWeek}
                onChange={e => setEditForm(f => ({ ...f, maxHoursPerWeek: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Leave blank for no limit. Scheduler won't exceed this per week.</p>
            </div>
            <Separator />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={() => updateStaff.mutate()} disabled={updateStaff.isPending}>
                {updateStaff.isPending ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default StaffDetail
