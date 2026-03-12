import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rulesAPI } from '@/lib/api'
import { Plus, Edit, Trash2, BookOpen, Sun, Moon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

interface Rule {
  id: string
  name: string
  shiftType: 'day' | 'night'
  shiftName?: string | null
  dayOfWeek: string
  requiredStaff: number
  genderPreference: 'male' | 'female' | 'any'
  requiredQualifications: string[]
  priority: number
  startHour: number
  endHour: number
  createdAt: string
}

const DAYS = ['everyday','monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const
function pad(n: number) { return String(n).padStart(2,'0') }

function blankForm(shiftType: 'day' | 'night' = 'day') {
  return {
    name: '', shiftType, shiftName: '',
    dayOfWeek: 'monday', requiredStaff: 2,
    genderPreference: 'any' as string,
    requiredQualifications: '', priority: 1,
    startHour: shiftType === 'day' ? 8 : 20,
    endHour: shiftType === 'day' ? 20 : 8,
  }
}

function RuleForm({
  value, onChange,
}: {
  value: ReturnType<typeof blankForm>
  onChange: (f: ReturnType<typeof blankForm>) => void
}) {
  const set = (k: keyof ReturnType<typeof blankForm>, v: any) => onChange({ ...value, [k]: v })

  // Auto-fill hours when shift type changes
  const setShiftType = (t: 'day' | 'night') => onChange({
    ...value, shiftType: t,
    startHour: t === 'day' ? 8 : 20,
    endHour: t === 'day' ? 20 : 8,
  })

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Rule Name *</Label>
          <Input value={value.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Monday Day" />
        </div>
        <div className="space-y-1.5">
          <Label>Shift Label (optional)</Label>
          <Input value={value.shiftName} onChange={e => set('shiftName', e.target.value)} placeholder="e.g. Morning, Late" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Shift Type *</Label>
          <Select value={value.shiftType} onValueChange={v => setShiftType(v as 'day' | 'night')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">☀ Day</SelectItem>
              <SelectItem value="night">🌙 Night</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Day of Week *</Label>
          <Select value={value.dayOfWeek} onValueChange={v => set('dayOfWeek', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DAYS.map(d => <SelectItem key={d} value={d} className="capitalize">{d === 'everyday' ? 'Every Day (*)' : d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Staff Required *</Label>
          <Input type="number" min={1} max={50} value={value.requiredStaff}
            onChange={e => set('requiredStaff', Math.max(1, parseInt(e.target.value)||1))} />
        </div>
        <div className="space-y-1.5">
          <Label>Start Hour (0–23)</Label>
          <Input type="number" min={0} max={23} value={value.startHour}
            onChange={e => set('startHour', Math.min(23, Math.max(0, parseInt(e.target.value)||0)))} />
        </div>
        <div className="space-y-1.5">
          <Label>End Hour (0–23)</Label>
          <Input type="number" min={0} max={23} value={value.endHour}
            onChange={e => set('endHour', Math.min(23, Math.max(0, parseInt(e.target.value)||0)))} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Gender Preference</Label>
          <Select value={value.genderPreference} onValueChange={v => set('genderPreference', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Priority (1–100)</Label>
          <Input type="number" min={1} max={100} value={value.priority}
            onChange={e => set('priority', Math.min(100, Math.max(1, parseInt(e.target.value)||1)))} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Required Qualifications (comma-separated)</Label>
        <Input value={value.requiredQualifications} onChange={e => set('requiredQualifications', e.target.value)}
          placeholder="e.g. First Aid, Forklift" />
      </div>
    </div>
  )
}

export default function Rules() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  const [createForm, setCreateForm] = useState(blankForm())
  const [editForm, setEditForm] = useState(blankForm())

  const { data, isLoading } = useQuery({ queryKey: ['rules'], queryFn: rulesAPI.getAll })
  const rules: Rule[] = data?.data?.data?.rules || []

  const parseQuals = (s: string) => s.split(',').map(q => q.trim()).filter(Boolean)

  const createMut = useMutation({
    mutationFn: (f: ReturnType<typeof blankForm>) => rulesAPI.create({
      name: f.name, shiftType: f.shiftType, shiftName: f.shiftName || undefined,
      dayOfWeek: f.dayOfWeek as any, requiredStaff: f.requiredStaff,
      genderPreference: f.genderPreference, priority: f.priority,
      startHour: f.startHour, endHour: f.endHour,
      requiredQualifications: parseQuals(f.requiredQualifications),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rules'] })
      setCreateOpen(false)
      setCreateForm(blankForm())
      toast({ title: 'Rule created' })
    },
    onError: () => toast({ title: 'Failed to create rule', variant: 'destructive' }),
  })

  const updateMut = useMutation({
    mutationFn: (f: ReturnType<typeof blankForm>) => rulesAPI.update(editingRule!.id, {
      name: f.name, shiftType: f.shiftType, shiftName: f.shiftName || undefined,
      dayOfWeek: f.dayOfWeek as any, requiredStaff: f.requiredStaff,
      genderPreference: f.genderPreference, priority: f.priority,
      startHour: f.startHour, endHour: f.endHour,
      requiredQualifications: parseQuals(f.requiredQualifications),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rules'] })
      setEditingRule(null)
      toast({ title: 'Rule updated' })
    },
    onError: () => toast({ title: 'Failed to update rule', variant: 'destructive' }),
  })

  const deleteMut = useMutation({
    mutationFn: rulesAPI.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rules'] }); toast({ title: 'Rule deleted' }) },
    onError: () => toast({ title: 'Failed to delete rule', variant: 'destructive' }),
  })

  const openEdit = (rule: Rule) => {
    setEditForm({
      name: rule.name, shiftType: rule.shiftType, shiftName: rule.shiftName || '',
      dayOfWeek: rule.dayOfWeek, requiredStaff: rule.requiredStaff,
      genderPreference: rule.genderPreference, priority: rule.priority,
      startHour: rule.startHour, endHour: rule.endHour,
      requiredQualifications: (rule.requiredQualifications || []).join(', '),
    })
    setEditingRule(rule)
  }

  // Group rules by day for display
  const byDay = DAYS.map(day => ({
    day, rules: rules.filter(r => r.dayOfWeek === day)
  })).filter(g => g.rules.length > 0)

  return (
    <div className="section-spacing">

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Shift Rules</CardTitle>
                <CardDescription>Define how many staff are needed per shift, per day. The scheduler uses these to build rosters.</CardDescription>
              </div>
            </div>
            <Button onClick={() => { setCreateForm(blankForm()); setCreateOpen(true) }}>
              <Plus className="h-4 w-4 mr-2" />New Rule
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Rules grouped by day */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium mb-1">No rules yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create your first shift rule to start generating schedules.</p>
            <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />Create Rule</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {byDay.map(({ day, rules: dayRules }) => (
            <div key={day}>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1">
                {day === 'everyday' ? 'Every Day (*)' : day.charAt(0).toUpperCase() + day.slice(1)}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {dayRules.map(rule => {
                  const isDay = rule.shiftType === 'day'
                  return (
                    <Card key={rule.id} className={`border-l-4 hover:shadow-md transition-shadow ${isDay ? 'border-l-amber-400' : 'border-l-indigo-500'}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {isDay
                                ? <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 text-xs"><Sun className="h-3 w-3 mr-1" />Day</Badge>
                                : <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-100 text-xs"><Moon className="h-3 w-3 mr-1" />Night</Badge>
                              }
                              {rule.shiftName && <Badge variant="outline" className="text-xs">{rule.shiftName}</Badge>}
                            </div>
                            <CardTitle className="text-sm">{rule.name}</CardTitle>
                            <CardDescription className="text-xs mt-0.5">
                              {rule.requiredStaff} staff · {pad(rule.startHour)}:00–{pad(rule.endHour)}:00
                              {rule.genderPreference !== 'any' && ` · ${rule.genderPreference} only`}
                              {rule.priority > 1 && ` · priority ${rule.priority}`}
                            </CardDescription>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rule)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive hover:bg-destructive/10"
                              onClick={() => { if (confirm('Delete this rule?')) deleteMut.mutate(rule.id) }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {rule.requiredQualifications?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {rule.requiredQualifications.map(q => (
                              <Badge key={q} variant="secondary" className="text-xs">{q}</Badge>
                            ))}
                          </div>
                        )}
                      </CardHeader>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Shift Rule</DialogTitle>
            <DialogDescription>Define when a shift runs and how many staff are needed.</DialogDescription>
          </DialogHeader>
          <RuleForm value={createForm} onChange={setCreateForm} />
          <Separator />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate(createForm)} disabled={!createForm.name || createMut.isPending}>
              {createMut.isPending ? 'Creating…' : 'Create Rule'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingRule} onOpenChange={o => !o && setEditingRule(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Rule</DialogTitle>
            <DialogDescription>{editingRule?.name}</DialogDescription>
          </DialogHeader>
          <RuleForm value={editForm} onChange={setEditForm} />
          <Separator />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingRule(null)}>Cancel</Button>
            <Button onClick={() => updateMut.mutate(editForm)} disabled={!editForm.name || updateMut.isPending}>
              {updateMut.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
