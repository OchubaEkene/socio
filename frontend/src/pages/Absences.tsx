import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { absencesAPI, staffAPI } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Plus, Check, X, Trash2, ClipboardList } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format, parseISO } from 'date-fns'
import Pagination from '@/components/Pagination'
import CoverageCalendar from '@/components/CoverageCalendar'

const ABSENCE_TYPES = ['SICK_LEAVE', 'PERSONAL_LEAVE', 'EMERGENCY', 'OTHER'] as const

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
  CANCELLED: 'outline',
}

function statusLabel(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ')
}

export default function Absences() {
  const { user, isManager, isAdmin } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isManagerOrAdmin = isManager() || isAdmin()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [page, setPage] = useState(1)
  const [form, setForm] = useState({
    staffId: user?.staff?.id || user?.staffId || '',
    absenceType: 'SICK_LEAVE' as typeof ABSENCE_TYPES[number],
    startDate: '',
    endDate: '',
    reason: '',
    notes: '',
  })

  const myStaffId = user?.staff?.id || user?.staffId

  const queryParams = {
    ...(statusFilter !== 'ALL' && { status: statusFilter }),
    ...(!isManagerOrAdmin && myStaffId ? { staffId: myStaffId } : {}),
    page,
    limit: 15,
  }

  const { data: absencesData, isLoading } = useQuery({
    queryKey: ['absences', queryParams],
    queryFn: () => absencesAPI.getAll(queryParams),
  })

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.getAll(),
    enabled: isManagerOrAdmin,
  })

  const createMutation = useMutation({
    mutationFn: absencesAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['absences'] })
      setIsCreateOpen(false)
      setForm({ staffId: user?.staffId || '', absenceType: 'SICK_LEAVE', startDate: '', endDate: '', reason: '', notes: '' })
      toast({ title: 'Absence request submitted' })
    },
    onError: (err: any) => {
      toast({ title: err.response?.data?.message || 'Failed to create absence', variant: 'destructive' })
    },
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: 'APPROVED' | 'REJECTED'; notes?: string }) =>
      absencesAPI.approve(id, { status, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['absences'] })
      toast({ title: 'Absence updated' })
    },
    onError: (err: any) => {
      toast({ title: err.response?.data?.message || 'Failed to update absence', variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: absencesAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['absences'] })
      toast({ title: 'Absence deleted' })
    },
    onError: (err: any) => {
      toast({ title: err.response?.data?.message || 'Failed to delete absence', variant: 'destructive' })
    },
  })

  const absences = absencesData?.data?.data?.absences || []
  const pagination = absencesData?.data?.data?.pagination
  const allStaff = staffData?.data?.staff || []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(form)
  }

  return (
    <div className="section-spacing">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Absences</CardTitle>
            </div>
            <Button onClick={() => setIsCreateOpen(true)} className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Request Absence</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter */}
          <div className="flex items-center space-x-3 mb-6">
            <Label>Status:</Label>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : absences.length === 0 ? (
            <p className="text-muted-foreground text-sm">No absences found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    {isManagerOrAdmin && <th className="pb-2 pr-4">Staff</th>}
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4">Start</th>
                    <th className="pb-2 pr-4">End</th>
                    <th className="pb-2 pr-4">Reason</th>
                    <th className="pb-2 pr-4">Status</th>
                    {isManagerOrAdmin && <th className="pb-2">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {absences.map((a: any) => (
                    <tr key={a.id} className="border-b last:border-0">
                      {isManagerOrAdmin && (
                        <td className="py-3 pr-4 font-medium">{a.staff?.name || a.staffId}</td>
                      )}
                      <td className="py-3 pr-4">{a.absenceType.replace('_', ' ')}</td>
                      <td className="py-3 pr-4">{format(parseISO(a.startDate), 'MMM d, yyyy')}</td>
                      <td className="py-3 pr-4">{format(parseISO(a.endDate), 'MMM d, yyyy')}</td>
                      <td className="py-3 pr-4 max-w-[200px] truncate">{a.reason}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={STATUS_BADGE[a.status] || 'outline'}>
                          {statusLabel(a.status)}
                        </Badge>
                      </td>
                      {isManagerOrAdmin && (
                        <td className="py-3">
                          <div className="flex items-center space-x-2">
                            {a.status === 'PENDING' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 border-green-200 hover:bg-green-50"
                                  onClick={() => approveMutation.mutate({ id: a.id, status: 'APPROVED' })}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                  onClick={() => approveMutation.mutate({ id: a.id, status: 'REJECTED' })}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600"
                                  onClick={() => deleteMutation.mutate(a.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={page}
                totalPages={pagination?.pages || 1}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coverage Calendar — manager/admin only */}
      {isManagerOrAdmin && (
        <CoverageCalendar />
      )}

      {/* Create Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Absence</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isManagerOrAdmin && (
              <div className="space-y-1">
                <Label>Staff Member</Label>
                <Select value={form.staffId} onValueChange={v => setForm(f => ({ ...f, staffId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {allStaff.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Absence Type</Label>
              <Select value={form.absenceType} onValueChange={v => setForm(f => ({ ...f, absenceType: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ABSENCE_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label>End Date</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
