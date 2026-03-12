import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vacationsAPI, staffAPI } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Plus, Check, X, Umbrella, Settings, TrendingUp } from 'lucide-react'
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

const VACATION_TYPES = ['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT', 'OTHER'] as const

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
  CANCELLED: 'outline',
}

export default function Vacations() {
  const { user, isManager, isAdmin } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isManagerOrAdmin = isManager() || isAdmin()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isPolicyOpen, setIsPolicyOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [page, setPage] = useState(1)
  const [policyForm, setPolicyForm] = useState({
    staffType: 'permanent' as 'permanent' | 'temporary',
    vacationType: 'ANNUAL' as typeof VACATION_TYPES[number],
    annualAllowance: '',
    carryOverLimit: '',
    minNoticeDays: '14',
    maxConsecutiveDays: '30',
  })
  const [form, setForm] = useState({
    staffId: user?.staffId || '',
    vacationType: 'ANNUAL' as typeof VACATION_TYPES[number],
    startDate: '',
    endDate: '',
    reason: '',
    notes: '',
  })

  const queryParams = {
    ...(statusFilter !== 'ALL' && { status: statusFilter }),
    ...(!isManagerOrAdmin && user?.staffId ? { staffId: user.staffId } : {}),
    page,
    limit: 15,
  }

  const { data: vacationsData, isLoading } = useQuery({
    queryKey: ['vacations', queryParams],
    queryFn: () => vacationsAPI.getAll(queryParams),
  })

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.getAll(),
    enabled: isManagerOrAdmin,
  })

  const { data: policiesData } = useQuery({
    queryKey: ['vacation-policies'],
    queryFn: vacationsAPI.getPolicies,
    enabled: isManagerOrAdmin,
  })

  const createPolicyMutation = useMutation({
    mutationFn: vacationsAPI.createPolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacation-policies'] })
      setIsPolicyOpen(false)
      setPolicyForm({ staffType: 'permanent', vacationType: 'ANNUAL', annualAllowance: '', carryOverLimit: '', minNoticeDays: '14', maxConsecutiveDays: '30' })
      toast({ title: 'Policy created' })
    },
    onError: (err: any) => {
      toast({ title: err.response?.data?.message || 'Failed to create policy', variant: 'destructive' })
    },
  })

  const createMutation = useMutation({
    mutationFn: vacationsAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacations'] })
      setIsCreateOpen(false)
      setForm({ staffId: user?.staffId || '', vacationType: 'ANNUAL', startDate: '', endDate: '', reason: '', notes: '' })
      toast({ title: 'Vacation request submitted' })
    },
    onError: (err: any) => {
      toast({ title: err.response?.data?.message || 'Failed to create vacation request', variant: 'destructive' })
    },
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: 'APPROVED' | 'REJECTED'; notes?: string }) =>
      vacationsAPI.approve(id, { status, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacations'] })
      toast({ title: 'Vacation request updated' })
    },
    onError: (err: any) => {
      toast({ title: err.response?.data?.message || 'Failed to update vacation request', variant: 'destructive' })
    },
  })

  const myStaffId = user?.staff?.id || user?.staffId

  const { data: balanceData } = useQuery({
    queryKey: ['vacation-balance', myStaffId],
    queryFn: () => vacationsAPI.getBalance(myStaffId!),
    enabled: !!myStaffId,
  })

  const vacations = vacationsData?.data?.data?.vacations || []
  const pagination = vacationsData?.data?.data?.pagination
  const allStaff = staffData?.data?.staff || []
  const policies = policiesData?.data?.data?.policies || policiesData?.data?.policies || []
  const balanceByType: Record<string, { used: number; allowance: number; remaining: number }> =
    balanceData?.data?.data?.balanceByType || balanceData?.data?.balanceByType || {}

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
                <Umbrella className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Vacation Requests</CardTitle>
            </div>
            <div className="flex items-center space-x-2">
              {isManagerOrAdmin && (
                <Button variant="outline" onClick={() => setIsPolicyOpen(true)} className="flex items-center space-x-2">
                  <Settings className="h-4 w-4" />
                  <span>Policies</span>
                </Button>
              )}
              <Button onClick={() => setIsCreateOpen(true)} className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Request Vacation</span>
              </Button>
            </div>
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

          {/* Vacation balance widget for staff with a linked record */}
          {myStaffId && Object.keys(balanceByType).length > 0 && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center space-x-2 mb-3">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">My Vacation Balance ({new Date().getFullYear()})</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(balanceByType).map(([type, bal]) => (
                  <div key={type} className="bg-background border rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{type}</p>
                    <p className="text-lg font-bold text-primary">{bal.remaining}</p>
                    <p className="text-xs text-muted-foreground">of {bal.allowance} days left</p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: bal.allowance > 0 ? `${Math.min(100, (bal.remaining / bal.allowance) * 100)}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : vacations.length === 0 ? (
            <p className="text-muted-foreground text-sm">No vacation requests found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    {isManagerOrAdmin && <th className="pb-2 pr-4">Staff</th>}
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4">Start</th>
                    <th className="pb-2 pr-4">End</th>
                    <th className="pb-2 pr-4">Days</th>
                    <th className="pb-2 pr-4">Reason</th>
                    <th className="pb-2 pr-4">Status</th>
                    {isManagerOrAdmin && <th className="pb-2">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {vacations.map((v: any) => (
                    <tr key={v.id} className="border-b last:border-0">
                      {isManagerOrAdmin && (
                        <td className="py-3 pr-4 font-medium">{v.staff?.name || v.staffId}</td>
                      )}
                      <td className="py-3 pr-4">{v.vacationType}</td>
                      <td className="py-3 pr-4">{format(parseISO(v.startDate), 'MMM d, yyyy')}</td>
                      <td className="py-3 pr-4">{format(parseISO(v.endDate), 'MMM d, yyyy')}</td>
                      <td className="py-3 pr-4">{v.totalDays ?? '—'}</td>
                      <td className="py-3 pr-4 max-w-[180px] truncate">{v.reason}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={STATUS_BADGE[v.status] || 'outline'}>
                          {v.status.charAt(0) + v.status.slice(1).toLowerCase()}
                        </Badge>
                      </td>
                      {isManagerOrAdmin && (
                        <td className="py-3">
                          {v.status === 'PENDING' && (
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-200 hover:bg-green-50"
                                onClick={() => approveMutation.mutate({ id: v.id, status: 'APPROVED' })}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => approveMutation.mutate({ id: v.id, status: 'REJECTED' })}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
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

      {/* Coverage Calendar — manager/admin only */}
      {isManagerOrAdmin && (
        <CoverageCalendar />
      )}

      {/* Policies Modal */}
      {isManagerOrAdmin && (
        <Dialog open={isPolicyOpen} onOpenChange={setIsPolicyOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Vacation Policies</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {policies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No policies configured yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">Staff Type</th>
                      <th className="pb-2 pr-4">Vacation Type</th>
                      <th className="pb-2 pr-4">Annual Days</th>
                      <th className="pb-2 pr-4">Min Notice</th>
                      <th className="pb-2">Max Consecutive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policies.map((p: any) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 capitalize">{p.staffType}</td>
                        <td className="py-2 pr-4">{p.vacationType}</td>
                        <td className="py-2 pr-4">{p.annualAllowance} days</td>
                        <td className="py-2 pr-4">{p.minNoticeDays} days</td>
                        <td className="py-2">{p.maxConsecutiveDays} days</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Add New Policy</h4>
                <form
                  className="grid grid-cols-2 gap-3"
                  onSubmit={e => {
                    e.preventDefault()
                    createPolicyMutation.mutate({
                      staffType: policyForm.staffType,
                      vacationType: policyForm.vacationType,
                      annualAllowance: parseInt(policyForm.annualAllowance),
                      carryOverLimit: policyForm.carryOverLimit ? parseInt(policyForm.carryOverLimit) : undefined,
                      minNoticeDays: parseInt(policyForm.minNoticeDays),
                      maxConsecutiveDays: parseInt(policyForm.maxConsecutiveDays),
                    })
                  }}
                >
                  <div className="space-y-1">
                    <Label>Staff Type</Label>
                    <Select value={policyForm.staffType} onValueChange={v => setPolicyForm(f => ({ ...f, staffType: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="permanent">Permanent</SelectItem>
                        <SelectItem value="temporary">Temporary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Vacation Type</Label>
                    <Select value={policyForm.vacationType} onValueChange={v => setPolicyForm(f => ({ ...f, vacationType: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VACATION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Annual Allowance (days)</Label>
                    <Input type="number" min="0" value={policyForm.annualAllowance} onChange={e => setPolicyForm(f => ({ ...f, annualAllowance: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label>Carry Over Limit (days)</Label>
                    <Input type="number" min="0" value={policyForm.carryOverLimit} onChange={e => setPolicyForm(f => ({ ...f, carryOverLimit: e.target.value }))} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label>Min Notice Days</Label>
                    <Input type="number" min="0" value={policyForm.minNoticeDays} onChange={e => setPolicyForm(f => ({ ...f, minNoticeDays: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Max Consecutive Days</Label>
                    <Input type="number" min="1" value={policyForm.maxConsecutiveDays} onChange={e => setPolicyForm(f => ({ ...f, maxConsecutiveDays: e.target.value }))} />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button type="submit" disabled={createPolicyMutation.isPending}>
                      {createPolicyMutation.isPending ? 'Creating...' : 'Create Policy'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Vacation</DialogTitle>
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
              <Label>Vacation Type</Label>
              <Select value={form.vacationType} onValueChange={v => setForm(f => ({ ...f, vacationType: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VACATION_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
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
