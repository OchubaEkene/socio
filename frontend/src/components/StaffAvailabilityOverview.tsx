import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { availabilityAPI } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, Filter, Download, Eye } from 'lucide-react';
import { format, parseISO, startOfWeek, addDays } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AvailabilityNotification from './AvailabilityNotification';


const StaffAvailabilityOverview: React.FC = () => {
  const navigate = useNavigate()
  const [selectedWeek, setSelectedWeek] = useState<string>(format(startOfWeek(new Date()), 'yyyy-MM-dd'));
  const [selectedStaffType, setSelectedStaffType] = useState<string>('all');

  const {
    data: availabilityData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['staff-availability-overview', selectedWeek, selectedStaffType],
    queryFn: () => availabilityAPI.getAll({
      week: selectedWeek,
      staffType: selectedStaffType === 'all' ? undefined : selectedStaffType
    }),
  });

  const handleWeekChange = (week: string) => {
    setSelectedWeek(week);
  };

  const handleStaffTypeChange = (staffType: string) => {
    setSelectedStaffType(staffType);
  };

  const getWeekDays = (weekStart: string) => {
    const start = parseISO(weekStart);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const formatTime = (timeString: string) => {
    return format(parseISO(timeString), 'HH:mm');
  };

  const getDayName = (date: Date) => {
    return format(date, 'EEE');
  };

  const getDayDate = (date: Date) => {
    return format(date, 'MMM d');
  };

  const handleExport = () => {
    const staffList: any[] = data?.staffAvailabilities || []
    const rows: string[][] = [['Staff Name', 'Staff Type', 'Gender', 'Date', 'Start Time', 'End Time', 'Notes']]
    for (const sa of staffList) {
      for (const av of sa.availabilities) {
        rows.push([
          sa.staff.name,
          sa.staff.staffType,
          sa.staff.gender,
          format(parseISO(av.startTime), 'yyyy-MM-dd'),
          format(parseISO(av.startTime), 'HH:mm'),
          format(parseISO(av.endTime), 'HH:mm'),
          av.notes || '',
        ])
      }
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `availability-${selectedWeek}.csv`
    a.click()
    URL.revokeObjectURL(url)
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load staff availability</p>
        <Button onClick={() => refetch()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  const weekDays = getWeekDays(selectedWeek);
  const data = availabilityData?.data?.data;

  return (
    <div className="space-y-6">
      {/* Notification for new submissions */}
      {data && data.totalStaff > 0 && (
        <AvailabilityNotification
          newSubmissions={data.totalAvailabilities}
          totalStaff={data.totalStaff}
          lastUpdated={format(new Date(), 'MMM d, yyyy HH:mm')}
        />
      )}

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Staff Availability Overview</span>
              </CardTitle>
              <CardDescription>
                View all staff availability submissions for the selected week
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Week:</span>
              <Select value={selectedWeek} onValueChange={handleWeekChange}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 4 }, (_, i) => {
                    const weekStart = startOfWeek(addDays(new Date(), i * 7));
                    const weekEnd = addDays(weekStart, 6);
                    return (
                      <SelectItem key={i} value={format(weekStart, 'yyyy-MM-dd')}>
                        {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Staff Type:</span>
              <Select value={selectedStaffType} onValueChange={handleStaffTypeChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="permanent">Permanent</SelectItem>
                  <SelectItem value="temporary">Temporary</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Staff</p>
                <p className="text-2xl font-bold">{data?.totalStaff || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Availabilities</p>
                <p className="text-2xl font-bold">{data?.totalAvailabilities || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
                <Calendar className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Week Period</p>
                <p className="text-sm font-medium">
                  {format(parseISO(selectedWeek), 'MMM d')} - {format(addDays(parseISO(selectedWeek), 6), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Availability List */}
      <div className="space-y-4">
        {data?.staffAvailabilities.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No availability submissions
                </h3>
                <p className="text-gray-600">
                  No staff members have submitted availability for the selected week.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          data?.staffAvailabilities.map((staffAvailability: any) => (
            <Card key={staffAvailability.staff.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {staffAvailability.staff.name}
                      </h3>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Badge variant={staffAvailability.staff.staffType === 'permanent' ? 'default' : 'secondary'}>
                          {staffAvailability.staff.staffType}
                        </Badge>
                        <span>•</span>
                        <span className="capitalize">{staffAvailability.staff.gender}</span>
                        <span>•</span>
                        <span>{staffAvailability.availabilities.length} time slots</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/staff/${staffAvailability.staff.id}`)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {staffAvailability.availabilities.length === 0 ? (
                  <p className="text-gray-500 text-sm">No availability submitted for this week.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                    {weekDays.map((day) => {
                      const dayAvailabilities = staffAvailability.availabilities.filter(
                        (availability: any) => format(parseISO(availability.startTime), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
                      );

                      return (
                        <div key={day.toISOString()} className="text-center">
                          <div className="text-xs font-medium text-gray-500 mb-1">
                            {getDayName(day)}
                          </div>
                          <div className="text-xs text-gray-400 mb-2">
                            {getDayDate(day)}
                          </div>
                          <div className="space-y-1">
                            {dayAvailabilities.map((availability: any) => (
                              <div
                                key={availability.id}
                                className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded"
                              >
                                {formatTime(availability.startTime)} - {formatTime(availability.endTime)}
                              </div>
                            ))}
                            {dayAvailabilities.length === 0 && (
                              <div className="text-xs text-gray-300">No availability</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default StaffAvailabilityOverview;
