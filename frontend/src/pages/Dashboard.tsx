import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { staffAPI, schedulingAPI, schedulePlansAPI, absencesAPI, vacationsAPI } from '@/lib/api'
import {
  Calendar, AlertTriangle, Users, Activity,
  ClipboardList, Umbrella
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format, parseISO } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { user, isManager, isAdmin } = useAuth()

  // Schedule plans count
  const { data: plansData } = useQuery({
    queryKey: ['schedule-plans'],
    queryFn: schedulePlansAPI.getAll,
    enabled: isManager() || isAdmin(),
  })
  const plans: any[] = plansData?.data?.data || []

  // Staff data
  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.getAll(),
  })

  // Staff schedule (for staff-role view)
  const { data: scheduleData, isLoading: scheduleLoading } = useQuery({
    queryKey: ['current-week-schedule'],
    queryFn: () => schedulingAPI.getCurrentWeekSchedule(),
    enabled: !isManager() && !isAdmin(),
  })

  // Pending approvals
  const { data: pendingAbsencesData } = useQuery({
    queryKey: ['absences-pending'],
    queryFn: absencesAPI.getPending,
    enabled: isManager() || isAdmin(),
  })
  const { data: pendingVacationsData } = useQuery({
    queryKey: ['vacations-pending'],
    queryFn: vacationsAPI.getPending,
    enabled: isManager() || isAdmin(),
  })

  const staff = staffData?.data?.staff || []
  const shifts = scheduleData?.data?.data?.shifts || []
  const pendingAbsences: any[] = pendingAbsencesData?.data?.data?.absences || pendingAbsencesData?.data?.absences || []
  const pendingVacations: any[] = pendingVacationsData?.data?.data?.vacations || pendingVacationsData?.data?.vacations || []
  const totalStaff = staff.length

  const myStaffId = user?.staff?.id || user?.staffId
  const myShifts = myStaffId ? shifts.filter((s: any) => s.staffId === myStaffId) : []

  return (
    <div className="section-spacing">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Dashboard</CardTitle>
                <CardDescription>
                  {isManager() || isAdmin() ? 'Manage your team and schedules' : 'Your personal dashboard'}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Pending Approvals */}
      {(isManager() || isAdmin()) && (pendingAbsences.length > 0 || pendingVacations.length > 0) && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span>Pending Approvals</span>
              <Badge variant="secondary">{pendingAbsences.length + pendingVacations.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {pendingAbsences.length > 0 && (
                <Button variant="outline" size="sm" className="border-yellow-300" onClick={() => navigate('/absences')}>
                  <ClipboardList className="h-4 w-4 mr-2 text-yellow-600" />
                  {pendingAbsences.length} Absence{pendingAbsences.length !== 1 ? 's' : ''} pending
                </Button>
              )}
              {pendingVacations.length > 0 && (
                <Button variant="outline" size="sm" className="border-yellow-300" onClick={() => navigate('/vacations')}>
                  <Umbrella className="h-4 w-4 mr-2 text-yellow-600" />
                  {pendingVacations.length} Vacation{pendingVacations.length !== 1 ? 's' : ''} pending
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {(isManager() || isAdmin()) ? (
        <div className="card-grid-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Staff</p>
                  <p className="text-2xl font-bold">{totalStaff}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
                  <Calendar className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Schedules</p>
                  <p className="text-2xl font-bold">{plans.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
                  <AlertTriangle className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Requests</p>
                  <p className="text-2xl font-bold">{pendingAbsences.length + pendingVacations.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="card-grid-2">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
                  <Calendar className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">My Shifts This Week</p>
                  <p className="text-2xl font-bold">{myShifts.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Team Size</p>
                  <p className="text-2xl font-bold">{totalStaff}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      {(isManager() || isAdmin()) ? (
        <div className="card-grid-3">
          <Card className="cursor-pointer hover:bg-muted/50 hover:border-primary/30 transition-all" onClick={() => navigate('/rota')}>
            <CardContent className="pt-6 flex flex-col items-center gap-3 py-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100">
                <ClipboardList className="h-7 w-7 text-purple-600" />
              </div>
              <span className="font-semibold text-sm">Manage Rota</span>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50 hover:border-primary/30 transition-all" onClick={() => navigate('/staff')}>
            <CardContent className="pt-6 flex flex-col items-center gap-3 py-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <span className="font-semibold text-sm">Manage Staff</span>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50 hover:border-primary/30 transition-all" onClick={() => navigate('/staff-availability')}>
            <CardContent className="pt-6 flex flex-col items-center gap-3 py-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100">
                <Calendar className="h-7 w-7 text-green-600" />
              </div>
              <span className="font-semibold text-sm">Staff Availability</span>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="cursor-pointer hover:bg-muted/50 transition-all" onClick={() => navigate('/staff-availability')}>
          <CardContent className="pt-6 flex flex-col items-center gap-3 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Calendar className="h-7 w-7 text-primary" />
            </div>
            <span className="font-semibold text-sm">Update My Availability</span>
          </CardContent>
        </Card>
      )}

      {/* My Schedule - Staff only */}
      {!isManager() && !isAdmin() && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" /><span>My Schedule This Week</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scheduleLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : myShifts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No shifts assigned to you this week.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-6">Day</th>
                      <th className="pb-2 pr-6">Date</th>
                      <th className="pb-2 pr-6">Shift</th>
                      <th className="pb-2">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myShifts
                      .slice()
                      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .map((shift: any) => (
                        <tr key={shift.id} className="border-b last:border-0">
                          <td className="py-3 pr-6 font-medium">{format(parseISO(shift.date.split('T')[0]), 'EEEE')}</td>
                          <td className="py-3 pr-6 text-muted-foreground">{format(parseISO(shift.date.split('T')[0]), 'MMM d')}</td>
                          <td className="py-3 pr-6">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${shift.shiftType === 'day' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                              {shift.shiftType === 'day' ? 'Day' : 'Night'}
                            </span>
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {shift.startTime ? `${format(new Date(shift.startTime), 'HH:mm')} – ${format(new Date(shift.endTime), 'HH:mm')}` : (shift.shiftType === 'day' ? '08:00 – 20:00' : '20:00 – 08:00')}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  )
}

export default Dashboard
