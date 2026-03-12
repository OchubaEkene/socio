import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { availabilityAPI } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar, 
  Save, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'

interface AvailabilityCalendarProps {
  staffId: string
  staffName: string
}

interface TimeSlot {
  day: string
  time: string
  selected: boolean
}

function AvailabilityCalendar({ staffId, staffName }: AvailabilityCalendarProps) {
  const [selectedWeek, setSelectedWeek] = useState(new Date())
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([])
  const [selectedCount, setSelectedCount] = useState(0)
  const { toast } = useToast()


  // Handle slot selection
  const toggleSlot = (day: string, time: string) => {
    setSelectedSlots(prev => {
      const newSlots = [...prev]
      const existingIndex = newSlots.findIndex(slot => slot.day === day && slot.time === time)
      
      if (existingIndex >= 0) {
        newSlots.splice(existingIndex, 1)
      } else {
        newSlots.push({ day, time, selected: true })
      }
      
      setSelectedCount(newSlots.length)
      return newSlots
    })
  }

  // Check if a slot is selected
  const isSlotSelected = (day: string, time: string) => {
    return selectedSlots.some(slot => slot.day === day && slot.time === time)
  }

  // Submit availability mutation
  const submitAvailabilityMutation = useMutation({
    mutationFn: (data: { staffId: string; availabilities: Array<{ startTime: string; endTime: string }> }) =>
      availabilityAPI.addBulk(data.staffId, { availabilities: data.availabilities }),
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Your availability has been submitted successfully. Your manager will use this information to create the schedule.",
      })
      setSelectedSlots([])
      setSelectedCount(0)
    },
    onError: (error: any) => {
      console.error('Availability submission error:', error)
      console.error('Error response:', error.response?.data)
      
      if (error.response?.status === 409) {
        toast({
          title: "Conflict",
          description: "Some time slots overlap with existing availability. Please select different times.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to submit availability. Please try again.",
          variant: "destructive",
        })
      }
    }
  })

  // Handle form submission
  const handleSubmit = () => {
    if (selectedSlots.length === 0) {
      toast({
        title: "No slots selected",
        description: "Please select at least one time slot.",
        variant: "destructive",
      })
      return
    }

    // Convert selected slots to the format expected by the API
    const availabilities = selectedSlots.map(slot => {
      const [year, month, day] = slot.day.split('-').map(Number)
      const [hour] = slot.time.split(':').map(Number)
      
      const startTime = new Date(year, month - 1, day, hour, 0, 0)
      const endTime = new Date(year, month - 1, day, hour + 1, 0, 0)
      
      return {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      }
    })

    submitAvailabilityMutation.mutate({
      staffId,
      availabilities
    })
  }

  // Navigation functions
  const goToPreviousWeek = () => {
    setSelectedWeek(prev => addDays(prev, -7))
  }

  const goToNextWeek = () => {
    setSelectedWeek(prev => addDays(prev, 7))
  }

  const goToCurrentWeek = () => {
    setSelectedWeek(new Date())
  }

  // Generate week days
  const weekDays: { date: Date; dayStr: string; dayName: string; dayNumber: string; isToday: boolean }[] = []
  const startDate = startOfWeek(selectedWeek, { weekStartsOn: 1 })
  
  for (let i = 0; i < 7; i++) {
    const day = addDays(startDate, i)
    weekDays.push({
      date: day,
      dayStr: format(day, 'yyyy-MM-dd'),
      dayName: format(day, 'EEE'),
      dayNumber: format(day, 'd'),
      isToday: isSameDay(day, new Date())
    })
  }

  return (
    <div className="section-spacing">
      {/* Professional Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Staff Availability</CardTitle>
              <CardDescription>
                Select available time slots for {staffName}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Week Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={goToPreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <h3 className="text-lg font-semibold">
                  {format(startDate, 'MMMM d')} - {format(addDays(startDate, 6), 'MMMM d, yyyy')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Week of {format(startDate, 'MMM d, yyyy')}
                </p>
              </div>
              <Button variant="outline" onClick={goToNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" onClick={goToCurrentWeek}>
              Today
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header Row */}
              <div className="grid grid-cols-8 gap-2 mb-4">
                <div className="h-12"></div> {/* Empty corner */}
                {weekDays.map((day) => (
                  <div
                    key={day.dayStr}
                    className={cn(
                      "h-12 flex flex-col items-center justify-center rounded-lg border",
                      day.isToday 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "bg-muted/50 border-border"
                    )}
                  >
                    <div className="text-xs font-medium">{day.dayName}</div>
                    <div className="text-sm font-bold">{day.dayNumber}</div>
                  </div>
                ))}
              </div>

              {/* Time Slots */}
              {Array.from({ length: 8 }, (_, hourIndex) => {
                const hour = hourIndex + 9
                const timeStr = `${hour.toString().padStart(2, '0')}:00`
                
                return (
                  <div key={hour} className="grid grid-cols-8 gap-2 mb-2">
                    {/* Time Label */}
                    <div className="h-12 flex items-center justify-center text-sm font-medium text-muted-foreground">
                      {timeStr}
                    </div>
                    
                    {/* Day Columns */}
                    {weekDays.map((day) => (
                      <button
                        key={`${day.dayStr}-${timeStr}`}
                        onClick={() => toggleSlot(day.dayStr, timeStr)}
                        className={cn(
                          "h-12 rounded-lg border-2 transition-all duration-200 hover:scale-105",
                          isSlotSelected(day.dayStr, timeStr)
                            ? "bg-primary border-primary text-primary-foreground shadow-md"
                            : "bg-background border-border hover:border-primary/50 hover:bg-primary/5"
                        )}
                      >
                        {isSlotSelected(day.dayStr, timeStr) && (
                          <Check className="h-4 w-4 mx-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend and Instructions */}
      <div className="card-grid-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Legend</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="h-6 w-6 rounded border-2 border-border bg-background"></div>
              <span className="text-sm">Available slot</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="h-6 w-6 rounded border-2 border-primary bg-primary flex items-center justify-center">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="text-sm">Selected slot</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="h-6 w-6 rounded border-2 border-primary bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                T
              </div>
              <span className="text-sm">Today</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>Instructions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              • Click on time slots to select/deselect your availability
            </p>
            <p className="text-sm text-muted-foreground">
              • Selected slots will be highlighted in blue
            </p>
            <p className="text-sm text-muted-foreground">
              • You can navigate between weeks using the arrows
            </p>
            <p className="text-sm text-muted-foreground">
              • Click "Today" to return to the current week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Submit Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{staffName}</span>
              </div>
              <Badge variant="secondary" className="flex items-center space-x-1">
                <span>{selectedCount}</span>
                <span>slots selected</span>
              </Badge>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={selectedCount === 0 || submitAvailabilityMutation.isPending}
              className="flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>
                {submitAvailabilityMutation.isPending 
                  ? 'Submitting...' 
                  : `Submit Availability (${selectedCount} slots)`
                }
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AvailabilityCalendar
