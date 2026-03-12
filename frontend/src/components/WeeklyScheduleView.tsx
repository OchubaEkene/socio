import React, { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { schedulingAPI, scheduleEditsAPI, staffAPI, spreadsheetExportAPI } from '../lib/api'
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, Sun, Moon, Plus, X, Users, Calendar, Download } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Shift {
  id: string
  staffId: string
  staffName: string
  date: string
  shiftType: 'day' | 'night'
  shiftName: string | null
  startTime: string
  endTime: string
}

interface StaffMember {
  id: string
  name: string
  staffType: 'permanent' | 'temporary'
}

interface ShiftSlot {
  key: string
  label: string
  shiftType: 'day' | 'night'
  startHour: number
  endHour: number
}

interface DragPayload {
  shiftId: string
  staffId: string
  staffName: string
  fromSlotKey: string
  fromDateStr: string
  shiftType: 'day' | 'night'
}

interface WeeklyScheduleViewProps {
  weekStart?: Date
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PALETTE = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444',
  '#F59E0B', '#10B981', '#06B6D4', '#3B82F6',
]

function avatarColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xff
  return PALETTE[h % PALETTE.length]
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function pad(n: number) { return String(n).padStart(2, '0') }

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WeeklyScheduleView({ weekStart: initial }: WeeklyScheduleViewProps) {
  const [weekStart, setWeekStart] = useState(
    initial ?? startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [modal, setModal] = useState<{ slot: ShiftSlot; date: Date; assigned: Shift[] } | null>(null)
  const [pickStaffId, setPickStaffId] = useState('')
  const [exporting, setExporting] = useState(false)

  const dragRef = useRef<DragPayload | null>(null)
  const qc = useQueryClient()
  const { toast } = useToast()
  const weekStr = format(weekStart, 'yyyy-MM-dd')
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const res = await spreadsheetExportAPI.exportCSV(weekStr)
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `schedule_${weekStr}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  // ─ Fetch ──────────────────────────────────────────────────────────────────

  const { data: schedData, isLoading } = useQuery({
    queryKey: ['week-schedule', weekStr],
    queryFn: () => schedulingAPI.getWeekSchedule(weekStr),
  })
  const { data: staffData } = useQuery({
    queryKey: ['staff-all'],
    queryFn: () => staffAPI.getAll({ limit: 200 }),
  })

  const shifts: Shift[] = schedData?.data?.data?.shifts ?? []
  const allStaff: StaffMember[] = staffData?.data?.staff ?? []

  // ─ Derive shift slots ─────────────────────────────────────────────────────

  const slotMap = new Map<string, ShiftSlot>()
  for (const s of shifts) {
    const label = s.shiftName ?? (s.shiftType === 'day' ? 'Day Shift' : 'Night Shift')
    const startH = new Date(s.startTime).getHours()
    const endH = new Date(s.endTime).getHours()
    const key = `${s.shiftType}::${startH}::${endH}`
    if (!slotMap.has(key)) slotMap.set(key, { key, label, shiftType: s.shiftType, startHour: startH, endHour: endH })
  }
  if (slotMap.size === 0) {
    slotMap.set('day::8::20', { key: 'day::8::20', label: 'Day Shift', shiftType: 'day', startHour: 8, endHour: 20 })
    slotMap.set('night::20::8', { key: 'night::20::8', label: 'Night Shift', shiftType: 'night', startHour: 20, endHour: 8 })
  }
  const slots = [...slotMap.values()].sort((a, b) => a.startHour - b.startHour)

  // ─ Cell index ─────────────────────────────────────────────────────────────

  function slotKeyFor(s: Shift) {
    const startH = new Date(s.startTime).getHours()
    const endH = new Date(s.endTime).getHours()
    return `${s.shiftType}::${startH}::${endH}`
  }

  const cellIndex = new Map<string, Shift[]>()
  for (const s of shifts) {
    const ds = s.date.split('T')[0]
    const key = `${slotKeyFor(s)}::${ds}`
    if (!cellIndex.has(key)) cellIndex.set(key, [])
    cellIndex.get(key)!.push(s)
  }
  function cellShifts(slotKey: string, ds: string) { return cellIndex.get(`${slotKey}::${ds}`) ?? [] }

  // ─ Mutations ──────────────────────────────────────────────────────────────

  const inv = () => qc.invalidateQueries({ queryKey: ['week-schedule'] })

  const assignMut = useMutation({
    mutationFn: scheduleEditsAPI.assignStaff,
    onSuccess: () => { inv(); setModal(null); toast({ title: 'Staff assigned.' }) },
    onError: (e: any) => toast({ title: e.response?.data?.message ?? 'Cannot assign — check availability', variant: 'destructive' }),
  })
  const removeMut = useMutation({
    mutationFn: scheduleEditsAPI.removeStaff,
    onSuccess: () => { inv(); toast({ title: 'Staff removed.' }) },
    onError: (e: any) => toast({ title: e.response?.data?.message ?? 'Failed', variant: 'destructive' }),
  })
  const swapMut = useMutation({
    mutationFn: scheduleEditsAPI.swapStaff,
    onSuccess: () => { inv(); toast({ title: 'Staff swapped.' }) },
    onError: (e: any) => toast({ title: e.response?.data?.message ?? 'Failed', variant: 'destructive' }),
  })
  const moveMut = useMutation({
    mutationFn: async ({ staffId, date, shiftType, oldId }: { staffId: string; date: string; shiftType: 'day' | 'night'; oldId: string }) => {
      await scheduleEditsAPI.assignStaff({ staffId, shiftId: 'new', date, shiftType })
      await scheduleEditsAPI.removeStaff(oldId)
    },
    onSuccess: () => { inv(); toast({ title: 'Staff moved.' }) },
    onError: () => { inv(); toast({ title: 'Cannot move — staff may be unavailable', variant: 'destructive' }) },
  })

  const busy = assignMut.isPending || removeMut.isPending || swapMut.isPending || moveMut.isPending

  // ─ Drag & Drop ────────────────────────────────────────────────────────────

  function startDrag(e: React.DragEvent, shift: Shift) {
    dragRef.current = {
      shiftId: shift.id, staffId: shift.staffId, staffName: shift.staffName,
      fromSlotKey: slotKeyFor(shift), fromDateStr: shift.date.split('T')[0],
      shiftType: shift.shiftType,
    }
    e.dataTransfer.effectAllowed = 'move'
  }
  function endDrag() { dragRef.current = null; setDragOver(null) }

  function onDragOver(e: React.DragEvent, cellKey: string) {
    if (!dragRef.current) return
    e.preventDefault()
    setDragOver(cellKey)
  }

  function onDrop(e: React.DragEvent, slot: ShiftSlot, date: Date) {
    e.preventDefault(); setDragOver(null)
    const drag = dragRef.current; if (!drag) return
    const ds = format(date, 'yyyy-MM-dd')

    if (drag.fromSlotKey === slot.key && drag.fromDateStr === ds) return

    const targets = cellShifts(slot.key, ds)
    const alreadyHere = targets.find(s => s.staffId === drag.staffId)
    if (alreadyHere) { toast({ title: `${drag.staffName} is already on this shift` }); return }

    if (targets.length > 0) {
      swapMut.mutate({ shift1Id: drag.shiftId, shift2Id: targets[0].id })
    } else {
      moveMut.mutate({ staffId: drag.staffId, date: ds, shiftType: slot.shiftType, oldId: drag.shiftId })
    }
    dragRef.current = null
  }

  // ─ Modal ──────────────────────────────────────────────────────────────────

  function openModal(slot: ShiftSlot, date: Date) {
    const ds = format(date, 'yyyy-MM-dd')
    setModal({ slot, date, assigned: cellShifts(slot.key, ds) })
    setPickStaffId('')
  }

  const assignedIds = new Set(modal?.assigned.map(s => s.staffId))
  const availableToPick = allStaff.filter(s => !assignedIds.has(s.id))

  const staffCount = new Set(shifts.map(s => s.staffId)).size

  // ─ Loading ────────────────────────────────────────────────────────────────

  if (isLoading) return (
    <div className="rounded-2xl border bg-card animate-pulse">
      <div className="h-14 bg-muted rounded-t-2xl" />
      {[...Array(2)].map((_, i) => <div key={i} className="h-32 border-t bg-muted/30" />)}
    </div>
  )

  // ─ Grid column template ───────────────────────────────────────────────────
  // Label col (fixed) + 7 day cols (equal, fill remaining width)
  const gridCols = '180px repeat(7, minmax(110px, 1fr))'

  // ─ Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* ── Week Navigation ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {format(weekStart, 'MMMM d')} – {format(addDays(weekStart, 6), 'MMMM d, yyyy')}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{shifts.length} shifts</span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{staffCount} staff scheduled</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setWeekStart(w => subWeeks(w, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Today
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setWeekStart(w => addWeeks(w, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs gap-1.5"
            onClick={handleExportCSV}
            disabled={exporting || shifts.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? 'Exporting…' : 'CSV'}
          </Button>
        </div>
      </div>

      {/* ── Grid ── fills full width, scrollable on small screens ── */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto -mx-1 px-1">
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, minWidth: '820px' }}>

          {/* ── Day header row ── */}
          {/* Corner cell */}
          <div className="border-b border-border bg-muted/50 px-4 py-3" />

          {days.map(day => {
            const today = isToday(day)
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'border-b border-l border-border px-3 py-5 text-center',
                  today ? 'bg-primary' : 'bg-muted/50'
                )}
              >
                <p className={cn('text-[10px] font-semibold uppercase tracking-widest', today ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                  {format(day, 'EEE')}
                </p>
                <p className={cn('text-3xl font-extrabold leading-none mt-0.5', today ? 'text-primary-foreground' : 'text-foreground')}>
                  {format(day, 'd')}
                </p>
                <p className={cn('text-[10px] mt-0.5', today ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                  {format(day, 'MMM')}
                </p>
              </div>
            )
          })}

          {/* ── Shift rows ── */}
          {slots.map((slot, si) => {
            const isDay = slot.shiftType === 'day'
            const prevSlot = slots[si - 1]
            const needsDivider = prevSlot && prevSlot.shiftType !== slot.shiftType

            return (
              <React.Fragment key={slot.key}>

                {/* Day → Night divider */}
                {needsDivider && (
                  <div style={{ gridColumn: '1 / -1' }} className="flex items-center gap-3 px-5 py-2.5 bg-muted/60 border-y border-border">
                    <div className="flex-1 h-px bg-border" />
                    <div className="flex items-center gap-1.5">
                      <Moon className="h-3 w-3 text-indigo-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Night Shifts</span>
                    </div>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                {/* ── Label cell ── */}
                <div className={cn(
                  'border-r border-b border-border px-5 py-6 flex flex-col justify-center gap-1',
                  isDay ? 'bg-amber-50 border-l-4 border-l-amber-400' : 'bg-slate-50 border-l-4 border-l-indigo-500'
                )}>
                  <div className={cn('flex items-center gap-1.5 text-base font-semibold', isDay ? 'text-amber-700' : 'text-indigo-700')}>
                    {isDay ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    {slot.label}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {pad(slot.startHour)}:00 – {pad(slot.endHour)}:00
                  </p>
                </div>

                {/* ── Day cells ── */}
                {days.map(day => {
                  const ds = format(day, 'yyyy-MM-dd')
                  const cellKey = `${slot.key}::${ds}`
                  const items = cellShifts(slot.key, ds)
                  const today = isToday(day)
                  const isOver = dragOver === cellKey

                  return (
                    <div
                      key={ds}
                      onDragOver={e => onDragOver(e, cellKey)}
                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }}
                      onDrop={e => onDrop(e, slot, day)}
                      className={cn(
                        'border-l border-b border-border p-3 align-top transition-colors',
                        today && !isOver && (isDay ? 'bg-amber-50/60' : 'bg-indigo-50/40'),
                        isOver && 'bg-primary/10 ring-2 ring-inset ring-primary',
                        busy && 'pointer-events-none'
                      )}
                    >
                      <div className="flex flex-col gap-1.5 min-h-[140px]">
                        {items.map(shift => (
                          <StaffChip
                            key={shift.id}
                            shift={shift}
                            shiftType={slot.shiftType}
                            onDragStart={startDrag}
                            onDragEnd={endDrag}
                            onRemove={() => removeMut.mutate(shift.id)}
                          />
                        ))}

                        {/* Add button */}
                        <button
                          onClick={() => openModal(slot, day)}
                          className={cn(
                            'flex items-center justify-center gap-1 w-full rounded-md border border-dashed text-xs transition-colors mt-auto',
                            items.length === 0
                              ? cn('py-4 font-medium',
                                isDay
                                  ? 'border-amber-200 text-amber-500 hover:border-amber-400 hover:bg-amber-50'
                                  : 'border-indigo-200 text-indigo-400 hover:border-indigo-400 hover:bg-indigo-50'
                              )
                              : 'py-1 border-transparent text-muted-foreground/40 hover:border-border hover:text-muted-foreground'
                          )}
                        >
                          <Plus className="h-3 w-3" />
                          {items.length === 0 && <span>Add staff</span>}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </React.Fragment>
            )
          })}

          {/* ── Daily totals row ── */}
          <div className="bg-muted/40 border-r border-border px-4 py-2.5 flex items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</span>
          </div>
          {days.map(day => {
            const ds = format(day, 'yyyy-MM-dd')
            const total = shifts.filter(s => s.date.split('T')[0] === ds).length
            const today = isToday(day)
            return (
              <div key={ds} className="bg-muted/40 border-l border-border px-2 py-2.5 flex items-center justify-center">
                {total > 0
                  ? <Badge variant={today ? 'default' : 'secondary'} className="text-xs tabular-nums">{total}</Badge>
                  : <span className="text-muted-foreground/30 text-sm">—</span>
                }
              </div>
            )
          })}

        </div>
        </div>

        {/* ── Footer legend ── */}
        <div className="flex items-center gap-5 px-5 py-2.5 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-200 border border-amber-400" />Day shift
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-100 border border-indigo-300" />Night shift
          </span>
          <span className="ml-auto text-muted-foreground/50">Drag chips to move · drop to swap</span>
        </div>
      </div>

      {/* ── Assign modal ── */}
      <Dialog open={!!modal} onOpenChange={o => !o && setModal(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modal?.slot.shiftType === 'day'
                ? <Sun className="h-4 w-4 text-amber-500" />
                : <Moon className="h-4 w-4 text-indigo-500" />}
              {modal?.slot.label}
            </DialogTitle>
            <DialogDescription>
              {modal && `${format(modal.date, 'EEEE, MMMM d')} · ${pad(modal.slot.startHour)}:00 – ${pad(modal.slot.endHour)}:00`}
            </DialogDescription>
          </DialogHeader>

          {modal && (
            <div className="space-y-4 pt-1">

              {/* Currently assigned */}
              {modal.assigned.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Assigned</p>
                  <div className="space-y-1.5">
                    {modal.assigned.map(s => {
                      const color = avatarColor(s.staffName)
                      return (
                        <div key={s.id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-muted/50">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                              style={{ backgroundColor: color }}>
                              {initials(s.staffName)}
                            </div>
                            <span className="text-sm font-medium">{s.staffName}</span>
                          </div>
                          <button
                            onClick={() => {
                              removeMut.mutate(s.id)
                              setModal(p => p ? { ...p, assigned: p.assigned.filter(x => x.id !== s.id) } : p)
                            }}
                            className="text-muted-foreground/40 hover:text-destructive transition-colors rounded p-1"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <Separator />

              {/* Add staff */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add staff member</p>
                <Select value={pickStaffId} onValueChange={setPickStaffId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select staff member…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableToPick.length === 0 ? (
                      <SelectItem value="__none" disabled>No available staff</SelectItem>
                    ) : (
                      availableToPick.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex items-center gap-2">
                            <span className="text-sm">{s.name}</span>
                            <Badge variant="outline" className="text-xs py-0">{s.staffType}</Badge>
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                <p className="text-xs text-muted-foreground">
                  Permanent staff are always eligible. Temporary staff need submitted availability.
                </p>

                <Button
                  className="w-full"
                  disabled={!pickStaffId || pickStaffId === '__none' || assignMut.isPending}
                  onClick={() => assignMut.mutate({
                    staffId: pickStaffId,
                    shiftId: 'new',
                    date: format(modal.date, 'yyyy-MM-dd'),
                    shiftType: modal.slot.shiftType,
                  })}
                >
                  {assignMut.isPending ? 'Assigning…' : 'Assign to shift'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Staff Chip ───────────────────────────────────────────────────────────────

interface StaffCardProps {
  shift: Shift
  shiftType: 'day' | 'night'
  onDragStart: (e: React.DragEvent, shift: Shift) => void
  onDragEnd: () => void
  onRemove: () => void
}

function StaffChip({ shift, shiftType, onDragStart, onDragEnd, onRemove }: StaffCardProps) {
  const color = avatarColor(shift.staffName)
  const isDay = shiftType === 'day'

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, shift)}
      onDragEnd={onDragEnd}
      title={shift.staffName}
      className={cn(
        'group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-grab min-w-0',
        'active:cursor-grabbing active:opacity-50 select-none transition-all',
        'hover:shadow-sm border',
        isDay
          ? 'bg-white border-amber-100 hover:border-amber-300'
          : 'bg-white border-indigo-100 hover:border-indigo-300',
      )}
    >
      <div
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-sm font-semibold text-gray-800 flex-1 min-w-0 break-words leading-snug">
        {shift.staffName}
      </span>
      <button
        onClick={e => { e.stopPropagation(); onRemove() }}
        className="opacity-20 group-hover:opacity-100 shrink-0 text-muted-foreground/50 hover:text-destructive transition-all"
        title="Remove"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
