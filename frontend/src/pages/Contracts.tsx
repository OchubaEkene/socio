import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { contractsAPI, staffAPI } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Plus, FileText, Pencil, Trash2, ChevronDown, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format } from 'date-fns'
import Pagination from '@/components/Pagination'

const CONTRACT_TYPES = ['FULL_TIME', 'PART_TIME', 'TEMPORARY', 'CONTRACTOR', 'INTERN'] as const
const EMPLOYMENT_STATUSES = ['ACTIVE', 'INACTIVE', 'TERMINATED', 'SUSPENDED', 'ON_LEAVE'] as const
const PAGE_SIZE = 15

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'default',
  INACTIVE: 'secondary',
  TERMINATED: 'destructive',
  SUSPENDED: 'destructive',
  ON_LEAVE: 'outline',
}

function label(str: string) { return str.replace(/_/g, ' ') }

const emptyForm = {
  staffId: '',
  contractType: 'FULL_TIME' as typeof CONTRACT_TYPES[number],
  startDate: '',
  endDate: '',
  probationEndDate: '',
  noticePeriod: '30',
  workingHoursPerWeek: '40',
  hourlyRate: '',
  salary: '',
  currency: 'USD',
  position: '',
  department: '',
  costCenter: '',
}

export default function Contracts() {
  const { isManager, isAdmin } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isManagerOrAdmin = isManager() || isAdmin()

  const [staffFilter, setStaffFilter] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<any | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [editStatus, setEditStatus] = useState('')
  const [prefForm, setPrefForm] = useState({ dayOfWeek: 'monday', shiftType: 'day', preferenceType: 'PREFERRED', reason: '', notes: '' })
  const [addingPrefFor, setAddingPrefFor] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', staffFilter],
    queryFn: () => contractsAPI.getAll({ ...(staffFilter && { staffId: staffFilter }) }),
  })

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.getAll(),
    enabled: isManagerOrAdmin,
  })

  const createMutation = useMutation({
    mutationFn: contractsAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      setIsCreateOpen(false)
      setForm(emptyForm)
      toast({ title: 'Contract created' })
    },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed to create contract', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => contractsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      setEditingContract(null)
      toast({ title: 'Contract updated' })
    },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed to update contract', variant: 'destructive' }),
  })

  const addPrefMutation = useMutation({
    mutationFn: ({ contractId, data }: { contractId: string; data: any }) =>
      contractsAPI.addPreference(contractId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      setAddingPrefFor(null)
      setPrefForm({ dayOfWeek: 'monday', shiftType: 'day', preferenceType: 'PREFERRED', reason: '', notes: '' })
      toast({ title: 'Preference saved' })
    },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed to save preference', variant: 'destructive' }),
  })

  const deletePrefMutation = useMutation({
    mutationFn: ({ contractId, prefId }: { contractId: string; prefId: string }) =>
      contractsAPI.deletePreference(contractId, prefId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      toast({ title: 'Preference removed' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: contractsAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      toast({ title: 'Contract deleted' })
    },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed to delete contract', variant: 'destructive' }),
  })

  const allContracts: any[] = data?.data?.data?.contracts || data?.data?.contracts || []
  const totalPages = Math.ceil(allContracts.length / PAGE_SIZE)
  const contracts = allContracts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const allStaff: any[] = staffData?.data?.staff || []

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      staffId: form.staffId,
      contractType: form.contractType,
      startDate: form.startDate,
      ...(form.endDate && { endDate: form.endDate }),
      ...(form.probationEndDate && { probationEndDate: form.probationEndDate }),
      noticePeriod: parseInt(form.noticePeriod),
      workingHoursPerWeek: parseFloat(form.workingHoursPerWeek),
      ...(form.hourlyRate && { hourlyRate: parseFloat(form.hourlyRate) }),
      ...(form.salary && { salary: parseFloat(form.salary) }),
      currency: form.currency || 'USD',
      ...(form.position && { position: form.position }),
      ...(form.department && { department: form.department }),
      ...(form.costCenter && { costCenter: form.costCenter }),
    })
  }

  const openEdit = (c: any) => {
    setEditingContract(c)
    setEditStatus(c.employmentStatus)
    setForm({
      staffId: c.staffId,
      contractType: c.contractType,
      startDate: c.startDate?.split('T')[0] || '',
      endDate: c.endDate?.split('T')[0] || '',
      probationEndDate: c.probationEndDate?.split('T')[0] || '',
      noticePeriod: String(c.noticePeriod),
      workingHoursPerWeek: String(c.workingHoursPerWeek),
      hourlyRate: c.hourlyRate != null ? String(c.hourlyRate) : '',
      salary: c.salary != null ? String(c.salary) : '',
      currency: c.currency || 'USD',
      position: c.position || '',
      department: c.department || '',
      costCenter: c.costCenter || '',
    })
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingContract) return
    updateMutation.mutate({
      id: editingContract.id,
      data: {
        contractType: form.contractType,
        employmentStatus: editStatus,
        endDate: form.endDate || null,
        probationEndDate: form.probationEndDate || null,
        noticePeriod: parseInt(form.noticePeriod),
        workingHoursPerWeek: parseFloat(form.workingHoursPerWeek),
        hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : undefined,
        salary: form.salary ? parseFloat(form.salary) : undefined,
        currency: form.currency,
        position: form.position || null,
        department: form.department || null,
        costCenter: form.costCenter || null,
        isActive: editStatus === 'ACTIVE',
      },
    })
  }

  return (
    <div className="section-spacing">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Employee Contracts</CardTitle>
            </div>
            {isManagerOrAdmin && (
              <Button onClick={() => { setForm(emptyForm); setIsCreateOpen(true) }} className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>New Contract</span>
              </Button>
            )}
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
          ) : contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contracts found.</p>
          ) : (
            <div className="space-y-3">
              {contracts.map((c: any) => (
                <div key={c.id} className="border rounded-lg overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  >
                    <div className="flex items-center space-x-4">
                      {expanded === c.id
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      }
                      <div>
                        <p className="font-medium">{c.staff?.name || c.staffId}</p>
                        <p className="text-xs text-muted-foreground">
                          {label(c.contractType)} · {c.position || 'No position'} · {c.department || 'No dept'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right text-sm text-muted-foreground hidden md:block">
                        <p>{format(new Date(c.startDate), 'MMM d, yyyy')} – {c.endDate ? format(new Date(c.endDate), 'MMM d, yyyy') : 'Ongoing'}</p>
                        <p>{c.workingHoursPerWeek}h/week</p>
                      </div>
                      <Badge variant={STATUS_VARIANT[c.employmentStatus] || 'outline'}>
                        {label(c.employmentStatus)}
                      </Badge>
                      {isManagerOrAdmin && (
                        <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {isAdmin() && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
                              onClick={() => deleteMutation.mutate(c.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {expanded === c.id && (
                    <div className="border-t bg-muted/10 px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Notice Period</p>
                        <p className="font-medium">{c.noticePeriod} days</p>
                      </div>
                      {c.salary != null && (
                        <div>
                          <p className="text-muted-foreground">Salary</p>
                          <p className="font-medium">{c.salary.toLocaleString()} {c.currency}</p>
                        </div>
                      )}
                      {c.hourlyRate != null && (
                        <div>
                          <p className="text-muted-foreground">Hourly Rate</p>
                          <p className="font-medium">{c.hourlyRate} {c.currency}/h</p>
                        </div>
                      )}
                      {c.costCenter && (
                        <div>
                          <p className="text-muted-foreground">Cost Center</p>
                          <p className="font-medium">{c.costCenter}</p>
                        </div>
                      )}
                      {c.probationEndDate && (
                        <div>
                          <p className="text-muted-foreground">Probation Ends</p>
                          <p className="font-medium">{format(new Date(c.probationEndDate), 'MMM d, yyyy')}</p>
                        </div>
                      )}
                      {c.manager && (
                        <div>
                          <p className="text-muted-foreground">Reporting Manager</p>
                          <p className="font-medium">{c.manager.name}</p>
                        </div>
                      )}
                      {c.qualifications?.length > 0 && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Qualifications</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {c.qualifications.map((q: string) => (
                              <span key={q} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">{q}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {c.benefits?.length > 0 && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Benefits</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {c.benefits.map((b: string) => (
                              <span key={b} className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">{b}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="col-span-2 md:col-span-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-muted-foreground">Shift Preferences</p>
                          {isManagerOrAdmin && (
                            <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setAddingPrefFor(addingPrefFor === c.id ? null : c.id) }}>
                              <Plus className="h-3 w-3 mr-1" /> Add
                            </Button>
                          )}
                        </div>
                        {addingPrefFor === c.id && (
                          <div className="bg-muted/30 rounded-lg p-3 mb-3 grid grid-cols-2 md:grid-cols-4 gap-2" onClick={e => e.stopPropagation()}>
                            <Select value={prefForm.dayOfWeek} onValueChange={v => setPrefForm(f => ({ ...f, dayOfWeek: v }))}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => (
                                  <SelectItem key={d} value={d}>{d}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={prefForm.shiftType} onValueChange={v => setPrefForm(f => ({ ...f, shiftType: v }))}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="day">Day</SelectItem>
                                <SelectItem value="night">Night</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select value={prefForm.preferenceType} onValueChange={v => setPrefForm(f => ({ ...f, preferenceType: v }))}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PREFERRED">Preferred</SelectItem>
                                <SelectItem value="AVAILABLE">Available</SelectItem>
                                <SelectItem value="UNAVAILABLE">Unavailable</SelectItem>
                                <SelectItem value="RESTRICTED">Restricted</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="sm" className="h-8 text-xs" onClick={() => addPrefMutation.mutate({ contractId: c.id, data: prefForm })} disabled={addPrefMutation.isPending}>
                              Save
                            </Button>
                          </div>
                        )}
                        {c.shiftPreferences?.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {c.shiftPreferences.map((p: any) => (
                              <span key={p.id} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                                p.preferenceType === 'PREFERRED' ? 'bg-green-100 text-green-800' :
                                p.preferenceType === 'UNAVAILABLE' ? 'bg-red-100 text-red-800' :
                                p.preferenceType === 'RESTRICTED' ? 'bg-orange-100 text-orange-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {p.dayOfWeek} {p.shiftType} – {label(p.preferenceType)}
                                {isManagerOrAdmin && (
                                  <button onClick={e => { e.stopPropagation(); deletePrefMutation.mutate({ contractId: c.id, prefId: p.id }) }} className="ml-1 opacity-60 hover:opacity-100">
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No preferences set</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Employee Contract</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Contract Type</Label>
                <Select value={form.contractType} onValueChange={v => setForm(f => ({ ...f, contractType: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map(t => <SelectItem key={t} value={t}>{label(t)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Currency</Label>
                <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} placeholder="USD" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label>End Date (optional)</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Hours/Week</Label>
                <Input type="number" step="0.5" value={form.workingHoursPerWeek} onChange={e => setForm(f => ({ ...f, workingHoursPerWeek: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label>Notice Period (days)</Label>
                <Input type="number" value={form.noticePeriod} onChange={e => setForm(f => ({ ...f, noticePeriod: e.target.value }))} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Salary (optional)</Label>
                <Input type="number" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} placeholder="Annual" />
              </div>
              <div className="space-y-1">
                <Label>Hourly Rate (optional)</Label>
                <Input type="number" step="0.01" value={form.hourlyRate} onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Position</Label>
                <Input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Department</Label>
                <Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Cost Center</Label>
              <Input value={form.costCenter} onChange={e => setForm(f => ({ ...f, costCenter: e.target.value }))} />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || !form.staffId || !form.startDate}>
                {createMutation.isPending ? 'Creating...' : 'Create Contract'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editingContract} onOpenChange={v => { if (!v) setEditingContract(null) }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contract — {editingContract?.staff?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Contract Type</Label>
                <Select value={form.contractType} onValueChange={v => setForm(f => ({ ...f, contractType: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map(t => <SelectItem key={t} value={t}>{label(t)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{label(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>End Date</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Probation End</Label>
                <Input type="date" value={form.probationEndDate} onChange={e => setForm(f => ({ ...f, probationEndDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Hours/Week</Label>
                <Input type="number" step="0.5" value={form.workingHoursPerWeek} onChange={e => setForm(f => ({ ...f, workingHoursPerWeek: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label>Notice Period (days)</Label>
                <Input type="number" value={form.noticePeriod} onChange={e => setForm(f => ({ ...f, noticePeriod: e.target.value }))} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Salary</Label>
                <Input type="number" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Hourly Rate</Label>
                <Input type="number" step="0.01" value={form.hourlyRate} onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Position</Label>
                <Input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Department</Label>
                <Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setEditingContract(null)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
