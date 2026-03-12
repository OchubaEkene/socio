import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { orgSettingsAPI } from '@/lib/api'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Building2, Clock, Users, Globe, Save, Loader } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

function HourSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {Array.from({ length: 24 }, (_, i) => (
        <option key={i} value={i}>
          {String(i).padStart(2, '0')}:00
        </option>
      ))}
    </select>
  )
}

export default function OrgSettings() {
  const qc = useQueryClient()
  const { toast } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['org-settings'],
    queryFn: orgSettingsAPI.get,
  })

  const settings = data?.data?.data

  const [form, setForm] = useState({
    orgName: '',
    timezone: 'UTC',
    dayShiftStart: 8,
    dayShiftEnd: 20,
    nightShiftStart: 20,
    nightShiftEnd: 8,
    defaultDayStaff: 2,
    defaultNightStaff: 2,
  })

  useEffect(() => {
    if (settings) {
      setForm({
        orgName: settings.orgName ?? '',
        timezone: settings.timezone ?? 'UTC',
        dayShiftStart: settings.dayShiftStart ?? 8,
        dayShiftEnd: settings.dayShiftEnd ?? 20,
        nightShiftStart: settings.nightShiftStart ?? 20,
        nightShiftEnd: settings.nightShiftEnd ?? 8,
        defaultDayStaff: settings.defaultDayStaff ?? 2,
        defaultNightStaff: settings.defaultNightStaff ?? 2,
      })
    }
  }, [settings])

  const [syncRules, setSyncRules] = useState(false)

  const mutation = useMutation({
    mutationFn: (data: typeof form) => orgSettingsAPI.update({ ...data, syncRulesToDefaults: syncRules }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-settings'] })
      if (syncRules) qc.invalidateQueries({ queryKey: ['rules'] })
      toast({ title: 'Settings saved', description: syncRules ? 'All shift rules have been updated to match.' : 'Organisation settings updated.' })
    },
    onError: () => toast({ title: 'Failed to save settings', variant: 'destructive' }),
  })

  const set = (field: keyof typeof form, value: any) =>
    setForm(f => ({ ...f, [field]: value }))

  if (isLoading) {
    return (
      <div className="section-spacing">
        <div className="flex items-center justify-center py-24">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="section-spacing">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Organisation Settings</CardTitle>
              <CardDescription>Configure your organisation's name, shift hours, and staffing defaults.</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Organisation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            Organisation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Organisation Name</Label>
              <Input
                value={form.orgName}
                onChange={e => set('orgName', e.target.value)}
                placeholder="e.g. Acme Care Ltd"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <select
                value={form.timezone}
                onChange={e => set('timezone', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="UTC">UTC</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Paris">Europe/Paris</option>
                <option value="Europe/Berlin">Europe/Berlin</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Chicago">America/Chicago</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="Australia/Sydney">Australia/Sydney</option>
                <option value="Asia/Dubai">Asia/Dubai</option>
                <option value="Asia/Lagos">Africa/Lagos</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staffing defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Staff Per Shift
          </CardTitle>
          <CardDescription>
            How many staff are required per shift. Saving this will update <strong>all existing rules</strong> to match.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Day shift */}
            <div className="rounded-xl border-2 border-amber-100 bg-amber-50/40 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-amber-800">Day Shift</span>
                <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">
                  {form.dayShiftStart}:00 &ndash; {form.dayShiftEnd}:00
                </Badge>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Staff required</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={form.defaultDayStaff}
                  onChange={e => set('defaultDayStaff', Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24"
                />
              </div>
            </div>

            {/* Night shift */}
            <div className="rounded-xl border-2 border-indigo-100 bg-indigo-50/40 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-indigo-800">Night Shift</span>
                <Badge variant="outline" className="text-indigo-700 border-indigo-200 text-xs">
                  {form.nightShiftStart}:00 &ndash; {form.nightShiftEnd}:00
                </Badge>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Staff required</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={form.defaultNightStaff}
                  onChange={e => set('defaultNightStaff', Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operating Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Operating Hours
          </CardTitle>
          <CardDescription>
            Define when each shift starts and ends. These are defaults used when generating new schedules.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Day shift hours */}
          <div>
            <p className="text-sm font-medium text-amber-700 mb-3">Day Shift Hours</p>
            <div className="grid grid-cols-2 gap-4 max-w-xs">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Start</Label>
                <HourSelect value={form.dayShiftStart} onChange={v => set('dayShiftStart', v)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">End</Label>
                <HourSelect value={form.dayShiftEnd} onChange={v => set('dayShiftEnd', v)} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Night shift hours */}
          <div>
            <p className="text-sm font-medium text-indigo-700 mb-3">Night Shift Hours</p>
            <div className="grid grid-cols-2 gap-4 max-w-xs">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Start</Label>
                <HourSelect value={form.nightShiftStart} onChange={v => set('nightShiftStart', v)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">End (next day)</Label>
                <HourSelect value={form.nightShiftEnd} onChange={v => set('nightShiftEnd', v)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center justify-end gap-4">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={syncRules} onChange={e => setSyncRules(e.target.checked)} className="rounded" />
          Apply defaults to all existing rules
        </label>
        <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} size="lg">
          {mutation.isPending
            ? <><Loader className="h-4 w-4 mr-2 animate-spin" />Saving&hellip;</>
            : <><Save className="h-4 w-4 mr-2" />Save Settings</>
          }
        </Button>
      </div>
    </div>
  )
}
