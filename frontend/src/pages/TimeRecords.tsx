import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { timeRecordsAPI, staffAPI } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Plus, Check, Trash2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format, parseISO } from 'date-fns'
import Pagination from '@/components/Pagination'

export default function TimeRecords() {
  const { user, isManager, isAdmin } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isManagerOrAdmin = isManager() || isAdmin()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [staffFilter, setStaffFilter] = useState('')
  const [page, setPage] = useState(1)
  const [form, setForm] = useState({
    staffId: user?.staffId || '',
    clockIn: '',
    clockOut: '',
    breakMinutes: '0',
    notes: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['time-records', staffFilter, page],
    queryFn: () => timeRecordsAPI.getAll({
      ...(staffFilter && { staffId: staffFilter }),
      page,
      limit: 20,
    }),
  })

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.getAll(),
    enabled: isManagerOrAdmin,
  })

  const createMutation = useMutation({
    mutationFn: timeRecordsAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-records'] })
      setIsCreateOpen(false)
      setForm({ staffId: user?.staffId || '', clockIn: '', clockOut: '', breakMinutes: '0', notes: '' })
      toast({ title: 'Time record created' })
    },
    onError: (err: any) => {
      toast({ title: err.response?.data?.message || 'Failed to create record', variant: 'destructive' })
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => timeRecordsAPI.update(id, { isApproved: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-records'] })
      toast({ title: 'Record approved' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: timeRecordsAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-records'] })
      toast({ title: 'Record deleted' })
    },
  })

  const records = data?.data?.data?.timeRecords || data?.data?.timeRecords || []
  const pagination = data?.data?.data?.pagination || data?.data?.pagination
  const allStaff = staffData?.data?.staff || []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      staffId: form.staffId,
      clockIn: new Date(form.clockIn).toISOString(),
      ...(form.clockOut && { clockOut: new Date(form.clockOut).toISOString() }),
      breakMinutes: parseInt(form.breakMinutes),
      ...(form.notes && { notes: form.notes }),
    })
  }

  return (
    <div className="section-spacing">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Time Records</CardTitle>
            </div>
            <Button onClick={() => setIsCreateOpen(true)} className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Add Record</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isManagerOrAdmin && (
            <div className="flex items-center space-x-3 mb-6">
              <Label>Staff:</Label>
              <Select value={staffFilter} onValueChange={v => { setStaffFilter(v); setPage(1) }}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All staff</SelectItem>
                  {allStaff.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-muted-foreground">No time records found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    {isManagerOrAdmin && <th className="pb-2 pr-4">Staff</th>}
                    <th className="pb-2 pr-4">Clock In</th>
                    <th className="pb-2 pr-4">Clock Out</th>
                    <th className="pb-2 pr-4">Break</th>
                    <th className="pb-2 pr-4">Total</th>
                    <th className="pb-2 pr-4">Status</th>
                    {isManagerOrAdmin && <th className="pb-2">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r: any) => (
                    <tr key={r.id} className="border-b last:border-0">
                      {isManagerOrAdmin && (
                        <td className="py-3 pr-4 font-medium">{r.staff?.name || r.staffId}</td>
                      )}
                      <td className="py-3 pr-4">{format(parseISO(r.clockIn), 'MMM d, HH:mm')}</td>
                      <td className="py-3 pr-4">
                        {r.clockOut ? format(parseISO(r.clockOut), 'MMM d, HH:mm') : <span className="text-yellow-600">In progress</span>}
                      </td>
                      <td className="py-3 pr-4">{r.breakMinutes}m</td>
                      <td className="py-3 pr-4 font-medium">
                        {r.totalHours != null ? `${r.totalHours.toFixed(1)}h` : '—'}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={r.isApproved ? 'default' : 'secondary'}>
                          {r.isApproved ? 'Approved' : 'Pending'}
                        </Badge>
                      </td>
                      {isManagerOrAdmin && (
                        <td className="py-3">
                          <div className="flex items-center space-x-2">
                            {!r.isApproved && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-200 hover:bg-green-50"
                                onClick={() => approveMutation.mutate(r.id)}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
                              onClick={() => deleteMutation.mutate(r.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} totalPages={pagination?.pages || 1} onPageChange={setPage} />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Time Record</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isManagerOrAdmin && (
              <div className="space-y-1">
                <Label>Staff Member</Label>
                <Select value={form.staffId} onValueChange={v => setForm(f => ({ ...f, staffId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>
                    {allStaff.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Clock In</Label>
                <Input
                  type="datetime-local"
                  value={form.clockIn}
                  onChange={e => setForm(f => ({ ...f, clockIn: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Clock Out (optional)</Label>
                <Input
                  type="datetime-local"
                  value={form.clockOut}
                  onChange={e => setForm(f => ({ ...f, clockOut: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Break (minutes)</Label>
              <Input
                type="number"
                min="0"
                value={form.breakMinutes}
                onChange={e => setForm(f => ({ ...f, breakMinutes: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
