import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { schedulePlansAPI } from '@/lib/api'
import { format, parseISO, startOfWeek } from 'date-fns'
import { ArrowLeft, Send, Mail, AlertTriangle, Calendar, Loader, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import WeeklyScheduleView from '@/components/WeeklyScheduleView'

export default function ScheduleView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [emailModal, setEmailModal] = useState(false)
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
  const [sending, setSending] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['schedule-plan', id],
    queryFn: () => schedulePlansAPI.getById(id!),
    enabled: !!id,
  })

  const plan = data?.data?.data?.plan
  const staffList: any[] = data?.data?.data?.staffList || []
  const exceptions: any[] = plan ? (plan.exceptionsData as any[]) || [] : []
  const planStart = plan ? startOfWeek(parseISO(plan.weekStart), { weekStartsOn: 1 }) : undefined

  const openEmailModal = () => {
    setSelectedStaffIds(staffList.map(s => s.id))
    setEmailModal(true)
  }

  const toggleStaff = (staffId: string) => {
    setSelectedStaffIds(prev =>
      prev.includes(staffId) ? prev.filter(x => x !== staffId) : [...prev, staffId]
    )
  }

  const toggleAll = () => {
    setSelectedStaffIds(prev =>
      prev.length === staffList.length ? [] : staffList.map(s => s.id)
    )
  }

  const handleSendEmails = async () => {
    if (!id || selectedStaffIds.length === 0) return
    setSending(true)
    try {
      const res = await schedulePlansAPI.sendEmails(id, selectedStaffIds)
      const { sent, total } = res.data?.data || {}
      toast({ title: 'Emails sent!', description: `${sent} of ${total} staff notified.` })
      qc.invalidateQueries({ queryKey: ['schedule-plan', id] })
      qc.invalidateQueries({ queryKey: ['schedule-plans'] })
      setEmailModal(false)
    } catch {
      toast({ title: 'Failed to send emails', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  if (isLoading) {
    return (
      <div className="section-spacing">
        <div className="flex items-center justify-center py-24">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (error || !plan) {
    return (
      <div className="section-spacing">
        <Card>
          <CardContent className="pt-10 pb-10 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="font-medium mb-4">Schedule not found.</p>
            <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="section-spacing">

      {/* ── Header ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <CardDescription>
                  {format(parseISO(plan.weekStart), 'MMM d')} – {format(parseISO(plan.weekEnd), 'MMM d, yyyy')}
                  {' · '}{plan.totalShifts} shifts
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={plan.status === 'published' ? 'default' : 'secondary'}>
                {plan.status}
              </Badge>
              {plan.emailsSent && (
                <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                  <Mail className="h-3 w-3 mr-1" />emails sent
                </Badge>
              )}
              <Button onClick={openEmailModal} disabled={staffList.length === 0}>
                <Send className="h-4 w-4 mr-2" />
                Send Emails
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ── Exceptions ── */}
      {exceptions.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              {exceptions.length} Scheduling Exception{exceptions.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {exceptions.map((ex: any, i: number) => (
                <div key={i} className="flex items-start gap-2.5 text-sm">
                  <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${ex.severity === 'error' ? 'text-red-500' : 'text-orange-400'}`} />
                  <span className="text-foreground flex-1">{ex.message}</span>
                  <Badge variant="outline" className="text-xs shrink-0 capitalize">{ex.dayOfWeek} {ex.shiftType}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Schedule Grid ── WeeklyScheduleView handles its own week navigation ── */}
      <WeeklyScheduleView weekStart={planStart} />

      {/* ── Send Emails Modal ── */}
      <Dialog open={emailModal} onOpenChange={setEmailModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Schedule Emails</DialogTitle>
            <DialogDescription>
              Select which staff to notify about <strong>{plan.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Select All */}
            <button
              onClick={toggleAll}
              className="flex items-center gap-3 w-full p-3 rounded-lg border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
            >
              <div className={`h-5 w-5 rounded flex items-center justify-center border-2 transition-colors shrink-0 ${
                selectedStaffIds.length === staffList.length ? 'bg-primary border-primary' : 'border-border'
              }`}>
                {selectedStaffIds.length === staffList.length && <Check className="h-3 w-3 text-white" />}
              </div>
              <span className="text-sm font-semibold">
                Select all · {staffList.length} staff member{staffList.length !== 1 ? 's' : ''}
              </span>
            </button>

            {/* Staff list */}
            <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
              {staffList.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => toggleStaff(s.id)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left"
                >
                  <div className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                    selectedStaffIds.includes(s.id) ? 'bg-primary border-primary' : 'border-border'
                  }`}>
                    {selectedStaffIds.includes(s.id) && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-none">{s.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.email || 'No saved email'}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{s.staffType}</Badge>
                </button>
              ))}
            </div>

            <Separator />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEmailModal(false)}>Cancel</Button>
              <Button onClick={handleSendEmails} disabled={selectedStaffIds.length === 0 || sending}>
                {sending
                  ? <><Loader className="h-4 w-4 mr-2 animate-spin" />Sending…</>
                  : <><Send className="h-4 w-4 mr-2" />Send to {selectedStaffIds.length}</>
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
