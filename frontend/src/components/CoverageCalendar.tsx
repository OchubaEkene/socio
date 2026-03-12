import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { absencesAPI, vacationsAPI } from '@/lib/api'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  parseISO,
  isWithinInterval,
} from 'date-fns'

interface CoverageEvent {
  staffName: string
  kind: 'absence' | 'vacation'
  label: string // absenceType or vacationType
}

function initials(name: string) {
  return name
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const KIND_COLORS: Record<'absence' | 'vacation', string> = {
  absence: 'bg-orange-100 text-orange-800 border-orange-200',
  vacation: 'bg-blue-100 text-blue-800 border-blue-200',
}

export default function CoverageCalendar() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))

  const monthStart = format(month, 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd')

  const { data: absencesData } = useQuery({
    queryKey: ['coverage-absences', monthStart],
    queryFn: () =>
      absencesAPI.getAll({ status: 'APPROVED', startDate: monthStart, endDate: monthEnd, limit: 200 }),
  })

  const { data: vacationsData } = useQuery({
    queryKey: ['coverage-vacations', monthStart],
    queryFn: () =>
      vacationsAPI.getAll({ status: 'APPROVED', startDate: monthStart, endDate: monthEnd, limit: 200 }),
  })

  const absences: any[] = absencesData?.data?.data?.absences || absencesData?.data?.absences || []
  const vacations: any[] = vacationsData?.data?.data?.vacations || vacationsData?.data?.vacations || []

  // Build calendar grid: start from Monday of the week containing the 1st
  const gridStart = startOfWeek(month, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  function eventsForDay(day: Date): CoverageEvent[] {
    const events: CoverageEvent[] = []
    for (const a of absences) {
      try {
        const start = parseISO(a.startDate)
        const end = parseISO(a.endDate)
        if (isWithinInterval(day, { start, end })) {
          events.push({
            staffName: a.staff?.name || a.staffId,
            kind: 'absence',
            label: a.absenceType?.replace('_', ' ') || 'ABSENCE',
          })
        }
      } catch {}
    }
    for (const v of vacations) {
      try {
        const start = parseISO(v.startDate)
        const end = parseISO(v.endDate)
        if (isWithinInterval(day, { start, end })) {
          events.push({
            staffName: v.staff?.name || v.staffId,
            kind: 'vacation',
            label: v.vacationType || 'VACATION',
          })
        }
      } catch {}
    }
    return events
  }

  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="border rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Coverage Calendar</h3>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-3 text-xs text-muted-foreground mr-3">
            <span className="inline-flex items-center space-x-1">
              <span className="inline-block w-2.5 h-2.5 rounded bg-orange-200 border border-orange-300" />
              <span>Absence</span>
            </span>
            <span className="inline-flex items-center space-x-1">
              <span className="inline-block w-2.5 h-2.5 rounded bg-blue-200 border border-blue-300" />
              <span>Vacation</span>
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setMonth(m => startOfMonth(new Date(m.getFullYear(), m.getMonth() - 1, 1)))}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-sm font-medium w-28 text-center">{format(month, 'MMMM yyyy')}</span>
          <Button variant="outline" size="sm" onClick={() => setMonth(m => startOfMonth(new Date(m.getFullYear(), m.getMonth() + 1, 1)))}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded overflow-hidden">
        {days.map(day => {
          const dayStr = format(day, 'yyyy-MM-dd')
          const isCurrentMonth = isSameMonth(day, month)
          const isToday = dayStr === today
          const events = isCurrentMonth ? eventsForDay(day) : []

          return (
            <div
              key={dayStr}
              className={`bg-background min-h-[72px] p-1.5 ${!isCurrentMonth ? 'opacity-30' : ''}`}
            >
              <div
                className={`text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {events.slice(0, 3).map((ev, i) => (
                  <div
                    key={i}
                    title={`${ev.staffName} — ${ev.label}`}
                    className={`text-[10px] leading-tight px-1 py-0.5 rounded border truncate ${KIND_COLORS[ev.kind]}`}
                  >
                    {initials(ev.staffName)}
                  </div>
                ))}
                {events.length > 3 && (
                  <div className="text-[10px] text-muted-foreground pl-1">+{events.length - 3} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
