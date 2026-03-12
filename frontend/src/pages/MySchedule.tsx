import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { schedulingAPI, timeRecordsAPI } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { ChevronLeft, ChevronRight, CalendarDays, LogIn, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { format, addDays } from 'date-fns'

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function MySchedule() {
  const { user, isManager, isAdmin } = useAuth()
  const isManagerOrAdmin = isManager() || isAdmin()
  const [weekStart, setWeekStart] = useState(getMonday(new Date()))
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const weekEnd = addDays(weekStart, 6)
  const weekStr = toDateStr(weekStart)
  const todayStr = toDateStr(new Date())

  const myStaffId = user?.staff?.id || user?.staffId

  const { data, isLoading } = useQuery({
    queryKey: ['schedule-week', weekStr],
    queryFn: () => schedulingAPI.getWeekSchedule(weekStr),
  })

  const { data: timeRecordsData } = useQuery({
    queryKey: ['time-records-week', weekStr, myStaffId],
    queryFn: () => timeRecordsAPI.getAll({
      staffId: myStaffId,
      startDate: weekStr,
      endDate: toDateStr(weekEnd),
    }),
    enabled: !!myStaffId,
  })

  const timeRecords: any[] = timeRecordsData?.data?.data?.timeRecords || timeRecordsData?.data?.timeRecords || []

  const clockInMutation = useMutation({
    mutationFn: (shift: any) => timeRecordsAPI.create({
      staffId: myStaffId!,
      clockIn: new Date().toISOString(),
      shiftId: shift.id,
    }),
    onSuccess: () => {
      toast({ title: 'Clocked in successfully' })
      queryClient.invalidateQueries({ queryKey: ['time-records-week'] })
    },
    onError: () => toast({ title: 'Failed to clock in', variant: 'destructive' }),
  })

  const clockOutMutation = useMutation({
    mutationFn: (recordId: string) => timeRecordsAPI.update(recordId, { clockOut: new Date().toISOString() }),
    onSuccess: () => {
      toast({ title: 'Clocked out successfully' })
      queryClient.invalidateQueries({ queryKey: ['time-records-week'] })
    },
    onError: () => toast({ title: 'Failed to clock out', variant: 'destructive' }),
  })

  const allShifts: any[] = data?.data?.shifts || data?.data?.data?.shifts || []

  // Filter to current user's staff shifts
  const myShifts = isManagerOrAdmin && myStaffId
    ? allShifts.filter((s: any) => s.staffId === myStaffId)
    : isManagerOrAdmin
    ? []
    : allShifts.filter((s: any) => s.staffId === myStaffId)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const shiftsOnDay = (date: Date) =>
    myShifts.filter((s: any) => {
      const shiftDate = s.date?.split?.('T')[0] || toDateStr(new Date(s.date))
      return shiftDate === toDateStr(date)
    })

  const getTimeRecordForShift = (shiftId: string) =>
    timeRecords.find((r: any) => r.shiftId === shiftId)

  const isCurrentWeek = toDateStr(getMonday(new Date())) === weekStr

  return (
    <div className="section-spacing">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>My Schedule</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => setWeekStart(w => addDays(w, -7))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant={isCurrentWeek ? 'default' : 'outline'}
                size="sm"
                onClick={() => setWeekStart(getMonday(new Date()))}
              >
                This Week
              </Button>
              <Button variant="outline" size="sm" onClick={() => setWeekStart(w => addDays(w, 7))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Not linked warning */}
          {!myStaffId && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-yellow-800 text-sm font-medium">Account not linked to a staff record</p>
              <p className="text-yellow-700 text-sm mt-1">
                Ask your manager to link your account in Staff Management to see your schedule here.
              </p>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <>
              {/* Week summary strip */}
              <div className="grid grid-cols-7 gap-2 mb-6">
                {weekDays.map((day, i) => {
                  const dayShifts = shiftsOnDay(day)
                  const isToday = toDateStr(day) === todayStr
                  return (
                    <div
                      key={i}
                      className={`rounded-lg border p-3 text-center ${
                        isToday ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <p className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                        {DAY_LABELS[i]}
                      </p>
                      <p className={`text-sm font-bold mb-2 ${isToday ? 'text-primary' : ''}`}>
                        {format(day, 'd')}
                      </p>
                      {dayShifts.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Off</p>
                      ) : (
                        dayShifts.map((s: any) => (
                          <Badge
                            key={s.id}
                            variant={s.shiftType === 'day' ? 'default' : 'secondary'}
                            className="text-xs w-full justify-center"
                          >
                            {s.shiftType === 'day' ? 'Day' : 'Night'}
                          </Badge>
                        ))
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Detailed list */}
              {myShifts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No shifts scheduled for this week.
                </p>
              ) : (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Shift Details</h3>
                  {myShifts
                    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((shift: any) => {
                      const shiftDate = new Date(shift.date)
                      const shiftDateStr = shift.date?.split?.('T')[0] || toDateStr(shiftDate)
                      const isToday = shiftDateStr === todayStr
                      const timeRecord = getTimeRecordForShift(shift.id)
                      const isClockedIn = timeRecord && !timeRecord.clockOut
                      const isClockedOut = timeRecord && timeRecord.clockOut

                      return (
                        <div key={shift.id} className="flex items-center justify-between border rounded-lg px-4 py-3">
                          <div className="flex items-center space-x-4">
                            <div className="text-center min-w-[48px]">
                              <p className="text-xs text-muted-foreground">{format(shiftDate, 'EEE')}</p>
                              <p className="font-bold">{format(shiftDate, 'd')}</p>
                            </div>
                            <div>
                              <p className="font-medium capitalize">{shift.shiftType} Shift</p>
                              {shift.startTime && shift.endTime && (
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(shift.startTime), 'HH:mm')} – {format(new Date(shift.endTime), 'HH:mm')}
                                </p>
                              )}
                              {isClockedIn && (
                                <p className="text-xs text-green-600 mt-0.5">
                                  Clocked in at {format(new Date(timeRecord.clockIn), 'HH:mm')}
                                </p>
                              )}
                              {isClockedOut && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {format(new Date(timeRecord.clockIn), 'HH:mm')} – {format(new Date(timeRecord.clockOut), 'HH:mm')}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={shift.shiftType === 'day' ? 'default' : 'secondary'}>
                              {shift.shiftType}
                            </Badge>
                            {isToday && myStaffId && !isClockedOut && (
                              isClockedIn ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => clockOutMutation.mutate(timeRecord.id)}
                                  disabled={clockOutMutation.isPending}
                                >
                                  <LogOut className="h-4 w-4 mr-1" />
                                  Clock Out
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => clockInMutation.mutate(shift)}
                                  disabled={clockInMutation.isPending}
                                >
                                  <LogIn className="h-4 w-4 mr-1" />
                                  Clock In
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}

              {/* Manager: if no linked staff, show all-team summary */}
              {isManagerOrAdmin && !myStaffId && allShifts.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Team Overview This Week</h3>
                  <div className="space-y-2">
                    {allShifts
                      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .slice(0, 20)
                      .map((shift: any) => (
                        <div key={shift.id} className="flex items-center justify-between border rounded-lg px-4 py-2 text-sm">
                          <span className="font-medium">{shift.staff?.name || shift.staffId}</span>
                          <span className="text-muted-foreground">{format(new Date(shift.date), 'EEE MMM d')}</span>
                          <Badge variant={shift.shiftType === 'day' ? 'default' : 'secondary'} className="text-xs">
                            {shift.shiftType}
                          </Badge>
                        </div>
                      ))}
                    {allShifts.length > 20 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        +{allShifts.length - 20} more shifts — use the main schedule view for full details
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
