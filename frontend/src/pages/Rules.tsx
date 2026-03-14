import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rulesAPI } from '@/lib/api'
import { Plus, Settings2, BookOpen, Sun, Moon, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

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
}

const DAYS = ['everyday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
type DayKey = typeof DAYS[number]
const DAY_LABELS: Record<DayKey, string> = {
  everyday: 'Every Day', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}
function pad(n: number) { return String(n).padStart(2, '0') }

function blankForm(day: DayKey = 'monday', shiftType: 'day' | 'night' = 'day') {
  return {
    name: `${DAY_LABELS[day]} ${shiftType === 'day' ? 'Day' : 'Night'}`,
    shiftType,
    dayOfWeek: day,
    requiredStaff: 2,
    genderPreference: 'any' as string,
    requiredQualifications: '',
    priority: 1,
    startHour: shiftType === 'day' ? 8 : 20,
    endHour: shiftType === 'day' ? 20 : 8,
  }
}

function RuleForm({ value, onChange }: { value: ReturnType<typeof blankForm>; onChange: (f: ReturnType<typeof blankForm>) => void }) {
  const set = (k: keyof ReturnType<typeof blankForm>, v: any) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Rule Name</Label>
          <Input value={value.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Staff Required</Label>
          <Input type="number" min={1} max={50} value={value.requiredStaff}
            onChange={e => set('requiredStaff', Math.max(1, parseInt(e.target.value) || 1))} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Start Hour</Label>
          <Input type="number" min={0} max={23} value={value.startHour}
            onChange={e => set('startHour', Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))} />
        </div>
        <div className="space-y-1.5">
          <Label>End Hour</Label>
          <Input type="number" min={0} max={23} value={value.endHour}
            onChange={e => set('endHour', Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))} />
        </div>
        <div className="space-y-1.5">
          <Label>Gender</Label>
          <Select value={value.genderPreference} onValueChange={v => set('genderPreference', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Qualifications (comma-separated)</Label>
        <Input value={value.requiredQualifications}
          onChange={e => set('requiredQualifications', e.target.value)}
          placeholder="e.g. First Aid, Forklift" />
      </div>
    </div>
  )
}

// Inline staff-count cell for the matrix
function StaffCell({
  rule, onQuickSave, onEdit, onCreate, day, shiftType,
}: {
  rule?: Rule
  onQuickSave: (id: string, count: number) => void
  onEdit: (rule: Rule) => void
  onCreate: (day: DayKey, shiftType: 'day' | 'night') => void
  day: DayKey
  shiftType: 'day' | 'night'
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(rule?.requiredStaff ?? 1)
  const isDay = shiftType === 'day'

  if (!rule) {
    return (
      <button
        onClick={() => onCreate(day, shiftType)}
        className="w-full h-full min-h-[56px] flex items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 text-muted-foreground/40 hover:border-muted-foreground/50 hover:text-muted-foreground transition-colors text-xs gap-1"
      >
        <Plus className="h-3 w-3" /> Add
      </button>
    )
  }

  return (
    <div className={cn(
      'rounded-lg border px-3 py-2.5 flex items-center gap-2 group',
      isDay ? 'border-amber-200 bg-amber-50/50' : 'border-indigo-200 bg-indigo-50/50'
    )}>
      {editing ? (
        <input
          autoFocus
          type="number"
          min={1} max={50}
          value={val}
          onChange={e => setVal(Math.max(1, parseInt(e.target.value) || 1))}
          onBlur={() => { onQuickSave(rule.id, val); setEditing(false) }}
          onKeyDown={e => { if (e.key === 'Enter') { onQuickSave(rule.id, val); setEditing(false) } if (e.key === 'Escape') { setVal(rule.requiredStaff); setEditing(false) } }}
          className="w-12 text-center border rounded px-1 py-0.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      ) : (
        <button
          onClick={() => { setVal(rule.requiredStaff); setEditing(true) }}
          className={cn('text-xl font-bold tabular-nums leading-none w-8 text-center rounded hover:bg-black/5 transition-colors',
            isDay ? 'text-amber-700' : 'text-indigo-700')}
          title="Click to change staff count"
        >
          {rule.requiredStaff}
        </button>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700 truncate">{rule.name}</p>
        <p className="text-xs text-muted-foreground">{pad(rule.startHour)}:00 – {pad(rule.endHour)}:00</p>
      </div>
      <button
        onClick={() => onEdit(rule)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-foreground transition-all shrink-0"
        title="Advanced settings"
      >
        <Settings2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export default function Rules() {
  const qc = useQueryClient()
  const { toast } = useToast()

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(blankForm())
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  const [editForm, setEditForm] = useState(blankForm())
  const [confirmDeleteRule, setConfirmDeleteRule] = useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['rules'], queryFn: rulesAPI.getAll })
  const rules: Rule[] = data?.data?.data?.rules || []

  const parseQuals = (s: string) => s.split(',').map(q => q.trim()).filter(Boolean)

  const createMut = useMutation({
    mutationFn: (f: ReturnType<typeof blankForm>) => rulesAPI.create({
      name: f.name, shiftType: f.shiftType, dayOfWeek: f.dayOfWeek as any,
      requiredStaff: f.requiredStaff, genderPreference: f.genderPreference as 'male' | 'female' | 'any',
      priority: f.priority, startHour: f.startHour, endHour: f.endHour,
      requiredQualifications: parseQuals(f.requiredQualifications),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rules'] }); setCreateOpen(false); toast({ title: 'Rule created' }) },
    onError: () => toast({ title: 'Failed to create rule', variant: 'destructive' }),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      rulesAPI.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rules'] }); setEditingRule(null); toast({ title: 'Rule updated' }) },
    onError: () => toast({ title: 'Failed to update rule', variant: 'destructive' }),
  })

  const deleteMut = useMutation({
    mutationFn: rulesAPI.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rules'] }); toast({ title: 'Rule deleted' }) },
    onError: () => toast({ title: 'Failed to delete rule', variant: 'destructive' }),
  })

  const openCreate = (day: DayKey, shiftType: 'day' | 'night') => {
    setCreateForm(blankForm(day, shiftType))
    setCreateOpen(true)
  }

  const openEdit = (rule: Rule) => {
    setEditForm({
      name: rule.name, shiftType: rule.shiftType, dayOfWeek: rule.dayOfWeek as DayKey,
      requiredStaff: rule.requiredStaff, genderPreference: rule.genderPreference,
      priority: rule.priority, startHour: rule.startHour, endHour: rule.endHour,
      requiredQualifications: (rule.requiredQualifications || []).join(', '),
    })
    setEditingRule(rule)
  }

  const handleQuickSave = (id: string, requiredStaff: number) => {
    updateMut.mutate({ id, data: { requiredStaff } })
  }

  // Find a rule for a specific day+shiftType combo
  const getRule = (day: DayKey, shiftType: 'day' | 'night') =>
    rules.find(r => r.dayOfWeek === day && r.shiftType === shiftType)

  // Only show days that have at least one rule, always show 'everyday' first
  const activeDays = DAYS.filter(day => rules.some(r => r.dayOfWeek === day))

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
                <CardDescription>Click a staff count to edit it inline. Use the settings icon for advanced options.</CardDescription>
              </div>
            </div>
            <Button onClick={() => openCreate('monday', 'day')}>
              <Plus className="h-4 w-4 mr-2" />New Rule
            </Button>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Column headers */}
            <div className="grid grid-cols-[140px_1fr_1fr] border-b bg-muted/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Day</span>
              <span className="flex items-center gap-1.5 pl-1"><Sun className="h-3.5 w-3.5 text-amber-500" />Day Shift</span>
              <span className="flex items-center gap-1.5 pl-1"><Moon className="h-3.5 w-3.5 text-indigo-500" />Night Shift</span>
            </div>

            {activeDays.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium mb-1">No rules yet</p>
                <p className="text-sm mb-4">Create your first shift rule to start generating schedules.</p>
                <Button onClick={() => openCreate('monday', 'day')}><Plus className="h-4 w-4 mr-2" />Create Rule</Button>
              </div>
            ) : (
              activeDays.map((day, i) => (
                <div
                  key={day}
                  className={cn('grid grid-cols-[140px_1fr_1fr] items-center gap-3 px-4 py-3', i < activeDays.length - 1 && 'border-b')}
                >
                  <span className="text-sm font-semibold text-gray-700">
                    {day === 'everyday' ? <span className="flex items-center gap-1.5"><Badge variant="secondary" className="text-xs">*</Badge>Every Day</span> : DAY_LABELS[day]}
                  </span>
                  <StaffCell rule={getRule(day, 'day')} day={day} shiftType="day"
                    onQuickSave={handleQuickSave} onEdit={openEdit} onCreate={openCreate} />
                  <StaffCell rule={getRule(day, 'night')} day={day} shiftType="night"
                    onQuickSave={handleQuickSave} onEdit={openEdit} onCreate={openCreate} />
                </div>
              ))
            )}

            {/* Add day row */}
            {activeDays.length > 0 && (
              <div className="border-t px-4 py-2.5 flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground self-center mr-1">Add day:</span>
                {DAYS.filter(d => !activeDays.includes(d)).map(day => (
                  <button
                    key={day}
                    onClick={() => openCreate(day, 'day')}
                    className="text-xs px-2.5 py-1 rounded-md border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                  >
                    + {DAY_LABELS[day]}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Shift Rule</DialogTitle>
            <DialogDescription>Define when a shift runs and how many staff are needed.</DialogDescription>
          </DialogHeader>
          <RuleForm value={createForm} onChange={setCreateForm} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate(createForm)} disabled={!createForm.name || createMut.isPending}>
              {createMut.isPending ? 'Creating…' : 'Create Rule'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingRule} onOpenChange={o => !o && setEditingRule(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Rule</DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              {editingRule?.shiftType === 'day'
                ? <><Sun className="h-3.5 w-3.5 text-amber-500" />Day shift</>
                : <><Moon className="h-3.5 w-3.5 text-indigo-500" />Night shift</>}
              · {editingRule?.dayOfWeek}
            </DialogDescription>
          </DialogHeader>
          <RuleForm value={editForm} onChange={setEditForm} />
          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmDeleteRule(true)}>
              <Trash2 className="h-4 w-4 mr-1.5" />Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingRule(null)}>Cancel</Button>
              <Button
                onClick={() => updateMut.mutate({
                  id: editingRule!.id,
                  data: {
                    name: editForm.name, shiftType: editForm.shiftType,
                    dayOfWeek: editForm.dayOfWeek as any,
                    requiredStaff: editForm.requiredStaff,
                    genderPreference: editForm.genderPreference as 'male' | 'female' | 'any',
                    priority: editForm.priority,
                    startHour: editForm.startHour, endHour: editForm.endHour,
                    requiredQualifications: parseQuals(editForm.requiredQualifications),
                  }
                })}
                disabled={!editForm.name || updateMut.isPending}
              >
                {updateMut.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteRule} onOpenChange={setConfirmDeleteRule}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This rule will be permanently removed and will no longer apply to schedule generation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteMut.mutate(editingRule!.id); setEditingRule(null); setConfirmDeleteRule(false) }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
