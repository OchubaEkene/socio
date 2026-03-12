import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { schedulePlansAPI } from '@/lib/api'
import { Calendar, Loader, Plus, ClipboardList, Mail, Eye, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { format, parseISO } from 'date-fns'

export default function Rota() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [scheduleName, setScheduleName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const { data: plansData } = useQuery({
    queryKey: ['schedule-plans'],
    queryFn: schedulePlansAPI.getAll,
  })
  const plans: any[] = plansData?.data?.data || []

  const createPlanMutation = useMutation({
    mutationFn: (data: { name: string; startDate: string; endDate: string }) =>
      schedulePlansAPI.create(data),
    onSuccess: (res) => {
      const d = res.data?.data
      queryClient.invalidateQueries({ queryKey: ['schedule-plans'] })
      queryClient.invalidateQueries({ queryKey: ['week-schedule'] })
      toast({
        title: `"${scheduleName}" created!`,
        description: `${d?.totalShifts ?? 0} shifts generated.`,
      })
      setScheduleName('')
      setStartDate('')
      setEndDate('')
    },
    onError: () => toast({ title: 'Failed to generate schedule', variant: 'destructive' }),
    onSettled: () => setIsGenerating(false),
  })

  const deletePlanMutation = useMutation({
    mutationFn: (id: string) => schedulePlansAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-plans'] })
      toast({ title: 'Schedule deleted' })
    },
  })

  const handleGenerate = () => {
    if (!scheduleName.trim()) { toast({ title: 'Enter a schedule name', variant: 'destructive' }); return }
    if (!startDate) { toast({ title: 'Select a start date', variant: 'destructive' }); return }
    if (!endDate) { toast({ title: 'Select an end date', variant: 'destructive' }); return }
    if (endDate < startDate) { toast({ title: 'End date must be after start date', variant: 'destructive' }); return }
    setIsGenerating(true)
    createPlanMutation.mutate({ name: scheduleName.trim(), startDate, endDate })
  }

  return (
    <div className="section-spacing">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Manage Rota</CardTitle>
              <CardDescription>Generate schedules and manage all rotas</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Generate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" /><span>Generate Schedule</span>
          </CardTitle>
          <CardDescription>Name it, pick a date range, then generate. Shifts are created for every week in the range.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Schedule name, e.g. March Rota"
              value={scheduleName}
              onChange={e => setScheduleName(e.target.value)}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex flex-col">
                <label className="text-xs text-muted-foreground mb-1">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <span className="text-muted-foreground mt-4">–</span>
              <div className="flex flex-col">
                <label className="text-xs text-muted-foreground mb-1">To</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          </div>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating
              ? <><Loader className="w-4 h-4 animate-spin mr-2" />Generating...</>
              : <><Plus className="w-4 h-4 mr-2" />Generate Schedule</>
            }
          </Button>
        </CardContent>
      </Card>

      {/* All Schedules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />All Schedules
          </CardTitle>
          <CardDescription>{plans.length} schedule{plans.length !== 1 ? 's' : ''} created</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {plans.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No schedules yet. Generate your first one above.
            </div>
          ) : (
            <div className="divide-y">
              {plans.map((plan: any) => (
                <div
                  key={plan.id}
                  onClick={() => navigate(`/schedules/${plan.id}`)}
                  className="group flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className={`shrink-0 flex h-11 w-11 items-center justify-center rounded-xl ${plan.status === 'published' ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Calendar className={`h-5 w-5 ${plan.status === 'published' ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm group-hover:text-primary transition-colors">{plan.name}</span>
                      <Badge variant={plan.status === 'published' ? 'default' : 'secondary'} className="text-xs">
                        {plan.status}
                      </Badge>
                      {plan.emailsSent && (
                        <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">
                          <Mail className="h-2.5 w-2.5 mr-1" />emails sent
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(parseISO(plan.weekStart), 'MMM d')} – {format(parseISO(plan.weekEnd), 'MMM d, yyyy')}
                      <span className="mx-1.5">·</span>{plan.totalShifts} shifts
                      <span className="mx-1.5">·</span>Created {format(parseISO(plan.createdAt), 'MMM d, yyyy')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                    <Eye className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                      onClick={e => { e.stopPropagation(); deletePlanMutation.mutate(plan.id) }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
