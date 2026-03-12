import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { shiftSwapsAPI, staffAPI, schedulingAPI } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Plus, Check, X, ArrowLeftRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { format, parseISO } from 'date-fns'
import Pagination from '@/components/Pagination'

const PAGE_SIZE = 10

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
  CANCELLED: 'outline',
}


export default function ShiftSwaps() {
  const { user, isManager, isAdmin } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isManagerOrAdmin = isManager() || isAdmin()
  const myStaffId = user?.staff?.id || user?.staffId

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [form, setForm] = useState({
    requesterId: myStaffId || '',
    responderId: '',
    requesterShiftId: '',
    responderShiftId: '',
    requesterReason: '',
  })

  const { data: swapsData, isLoading } = useQuery({
    queryKey: ['shift-swaps', statusFilter],
    queryFn: () =>
      isManagerOrAdmin
        ? shiftSwapsAPI.getAll({ ...(statusFilter !== 'ALL' && { status: statusFilter }) })
        : shiftSwapsAPI.getMySwaps(),
  })

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.getAll(),
  })

  // Load 4 weeks of shifts for the swap form
  const weekStarts = (() => {
    const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); d.setHours(0,0,0,0)
    return [0, 1, 2, 3].map(offset => {
      const w = new Date(d); w.setDate(w.getDate() + offset * 7); return w.toISOString().split('T')[0]
    })
  })()

  const weekQueries = [
    useQuery({ queryKey: ['shifts-week', weekStarts[0]], queryFn: () => schedulingAPI.getWeekSchedule(weekStarts[0]) }),
    useQuery({ queryKey: ['shifts-week', weekStarts[1]], queryFn: () => schedulingAPI.getWeekSchedule(weekStarts[1]) }),
    useQuery({ queryKey: ['shifts-week', weekStarts[2]], queryFn: () => schedulingAPI.getWeekSchedule(weekStarts[2]) }),
    useQuery({ queryKey: ['shifts-week', weekStarts[3]], queryFn: () => schedulingAPI.getWeekSchedule(weekStarts[3]) }),
  ]

  const createMutation = useMutation({
    mutationFn: shiftSwapsAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-swaps'] })
      setIsCreateOpen(false)
      setForm({ requesterId: user?.staffId || '', responderId: '', requesterShiftId: '', responderShiftId: '', requesterReason: '' })
      toast({ title: 'Swap request submitted' })
    },
    onError: (err: any) => {
      toast({ title: err.response?.data?.message || 'Failed to create swap request', variant: 'destructive' })
    },
  })

  const respondMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'APPROVED' | 'REJECTED'; reason?: string }) =>
      shiftSwapsAPI.respond(id, { status, responderReason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-swaps'] })
      toast({ title: 'Response submitted' })
    },
    onError: (err: any) => {
      toast({ title: err.response?.data?.message || 'Failed to respond', variant: 'destructive' })
    },
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      shiftSwapsAPI.approve(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-swaps'] })
      toast({ title: 'Swap updated' })
    },
    onError: (err: any) => {
      toast({ title: err.response?.data?.message || 'Failed to update swap', variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: shiftSwapsAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-swaps'] })
      toast({ title: 'Swap request cancelled' })
    },
  })

  const allSwaps = swapsData?.data?.swaps || swapsData?.data || []
  const totalPages = Math.ceil(allSwaps.length / PAGE_SIZE)
  const swaps = allSwaps.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const allStaff = staffData?.data?.staff || []
  const allShifts: any[] = weekQueries.flatMap(q => q.data?.data?.data?.shifts || q.data?.data?.shifts || [])

  // Shifts for the selected requester / responder for the create form
  const requesterShifts = allShifts.filter((s: any) => s.staffId === form.requesterId)
  const responderShifts = allShifts.filter((s: any) => s.staffId === form.responderId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      requesterId: form.requesterId,
      responderId: form.responderId,
      requesterShiftId: form.requesterShiftId,
      responderShiftId: form.responderShiftId,
      requesterReason: form.requesterReason || undefined,
    })
  }

  function shiftLabel(shift: any) {
    if (!shift) return '—'
    const d = shift.date?.split?.('T')[0] || shift.date
    return `${format(parseISO(d), 'EEE MMM d')} – ${shift.shiftType}`
  }

  return (
    <div className="section-spacing">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <ArrowLeftRight className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Shift Swaps</CardTitle>
            </div>
            <Button onClick={() => setIsCreateOpen(true)} className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Request Swap</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isManagerOrAdmin && (
            <div className="flex items-center space-x-3 mb-6">
              <Label>Status:</Label>
              <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1) }}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="STAFF_APPROVED">Staff Approved</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : allSwaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No swap requests found.</p>
          ) : (
            <div className="space-y-4">
              {swaps.map((swap: any) => {
                const isRequester = swap.requesterId === myStaffId
                const isResponder = swap.responderId === myStaffId
                return (
                  <div key={swap.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{swap.requester?.name || swap.requesterId}</span>
                          <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{swap.responder?.name || swap.responderId}</span>
                          <Badge variant={STATUS_BADGE[swap.status] || 'outline'}>
                            {swap.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Requester shift:</span>{' '}
                          {shiftLabel(swap.requesterShift)}
                          {' → '}
                          <span className="font-medium">Responder shift:</span>{' '}
                          {shiftLabel(swap.responderShift)}
                        </div>
                        {swap.requesterReason && (
                          <p className="text-sm text-muted-foreground">Reason: {swap.requesterReason}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {/* Responder: can approve/reject PENDING swaps */}
                        {isResponder && swap.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-200 hover:bg-green-50"
                              onClick={() => respondMutation.mutate({ id: swap.id, status: 'APPROVED' })}
                            >
                              <Check className="h-3 w-3 mr-1" /> Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => respondMutation.mutate({ id: swap.id, status: 'REJECTED' })}
                            >
                              <X className="h-3 w-3 mr-1" /> Decline
                            </Button>
                          </>
                        )}
                        {/* Manager: final approve/reject after both staff agree */}
                        {isManagerOrAdmin && swap.status === 'STAFF_APPROVED' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-200 hover:bg-green-50"
                              onClick={() => approveMutation.mutate({ id: swap.id, status: 'APPROVED' })}
                            >
                              <Check className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => approveMutation.mutate({ id: swap.id, status: 'REJECTED' })}
                            >
                              <X className="h-3 w-3 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                        {/* Requester: cancel PENDING request */}
                        {isRequester && swap.status === 'PENDING' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => deleteMutation.mutate(swap.id)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Shift Swap</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isManagerOrAdmin && (
              <div className="space-y-1">
                <Label>Requester Staff Record</Label>
                <Select
                  value={form.requesterId}
                  onValueChange={v => setForm(f => ({ ...f, requesterId: v, requesterShiftId: '' }))}
                >
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
              <Label>Your Shift to Give Up</Label>
              <Select
                value={form.requesterShiftId}
                onValueChange={v => setForm(f => ({ ...f, requesterShiftId: v }))}
                disabled={!form.requesterId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.requesterId ? 'Select your shift' : 'Select staff first'} />
                </SelectTrigger>
                <SelectContent>
                  {requesterShifts.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{shiftLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Swap With</Label>
              <Select
                value={form.responderId}
                onValueChange={v => setForm(f => ({ ...f, responderId: v, responderShiftId: '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select colleague" />
                </SelectTrigger>
                <SelectContent>
                  {allStaff
                    .filter((s: any) => s.id !== form.requesterId)
                    .map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Their Shift to Take</Label>
              <Select
                value={form.responderShiftId}
                onValueChange={v => setForm(f => ({ ...f, responderShiftId: v }))}
                disabled={!form.responderId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.responderId ? 'Select their shift' : 'Select colleague first'} />
                </SelectTrigger>
                <SelectContent>
                  {responderShifts.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{shiftLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Reason (optional)</Label>
              <Input
                value={form.requesterReason}
                onChange={e => setForm(f => ({ ...f, requesterReason: e.target.value }))}
                placeholder="Why do you need this swap?"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !form.requesterShiftId || !form.responderShiftId}
              >
                {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
