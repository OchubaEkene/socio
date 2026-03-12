import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI } from '@/lib/api';
import { format } from 'date-fns';
import {
  BarChart3,
  Clock,
  Users,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SimpleBarChart from '@/components/SimpleBarChart';

function Reports() {
  const [selectedDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(selectedDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(selectedDate.getFullYear());

  const {
    data: monthlyData,
    isLoading: monthlyLoading,
    error: monthlyError
  } = useQuery({
    queryKey: ['monthly-report', selectedMonth, selectedYear],
    queryFn: () => reportsAPI.getMonthlyReport({ month: selectedMonth, year: selectedYear }),
  });

  const {
    data: distributionData,
    isLoading: distributionLoading,
    error: distributionError
  } = useQuery({
    queryKey: ['shift-distribution', selectedMonth, selectedYear],
    queryFn: () => reportsAPI.getShiftDistribution({ month: selectedMonth, year: selectedYear }),
  });

  const handlePreviousMonth = () => {
    const newDate = new Date(selectedYear, selectedMonth - 2, 1);
    setSelectedMonth(newDate.getMonth() + 1);
    setSelectedYear(newDate.getFullYear());
  };

  const handleNextMonth = () => {
    const newDate = new Date(selectedYear, selectedMonth, 1);
    setSelectedMonth(newDate.getMonth() + 1);
    setSelectedYear(newDate.getFullYear());
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth(now.getMonth() + 1);
    setSelectedYear(now.getFullYear());
  };

  const formatHours = (hours: number) => {
    return `${hours}h`;
  };

  const getMonthName = (month: number) => {
    const date = new Date(selectedYear, month - 1, 1);
    return format(date, 'MMMM yyyy');
  };

  if (monthlyLoading || distributionLoading) {
    return (
      <div className="section-spacing">
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Monthly Reports</CardTitle>
                <CardDescription>Loading report data...</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
        
        <div className="card-grid-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="skeleton-text w-1/3 mb-2"></div>
                <div className="skeleton-text w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="card-grid-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="skeleton-text w-1/4"></div>
                  <div className="skeleton-text w-full h-32"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (monthlyError || distributionError) {
    return (
      <div className="section-spacing">
        <Card>
          <CardContent className="pt-6">
            <div className="empty-state">
              <div className="empty-state-icon">
                <AlertTriangle className="h-12 w-12" />
              </div>
              <h3 className="empty-state-title">Failed to load reports</h3>
              <p className="empty-state-description">
                Please try refreshing the page or contact support.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const monthlyReport = monthlyData?.data?.data;
  const distributionReport = distributionData?.data?.data;

  if (!monthlyReport || !distributionReport) {
    return (
      <div className="section-spacing">
        <Card>
          <CardContent className="pt-6">
            <div className="empty-state">
              <div className="empty-state-icon">
                <BarChart3 className="h-12 w-12" />
              </div>
              <h3 className="empty-state-title">No report data available</h3>
              <p className="empty-state-description">
                There are no reports available for the selected period.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="section-spacing">
      {/* Professional Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Monthly Reports</CardTitle>
                <CardDescription>Comprehensive analysis of staff performance and shift distribution</CardDescription>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={handlePreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Button variant="outline" onClick={handleCurrentMonth}>
                Current Month
              </Button>
              
              <Button variant="outline" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              <Badge variant="secondary" className="text-sm font-medium">
                {getMonthName(selectedMonth)}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      <div className="card-grid-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold">
                  {formatHours(monthlyReport.summary.totalHours)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Shifts</p>
                <p className="text-2xl font-bold">
                  {monthlyReport.summary.totalShifts}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Staff</p>
                <p className="text-2xl font-bold">
                  {monthlyReport.summary.totalStaff}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Unresolved Issues</p>
                <p className="text-2xl font-bold">
                  {monthlyReport.summary.unresolvedExceptions}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Tables */}
      <div className="card-grid-2">
        {/* Staff Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Staff Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyReport.staffPerformance.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Users className="h-12 w-12" />
                </div>
                <h3 className="empty-state-title">No performance data</h3>
                <p className="empty-state-description">
                  No staff performance data for this month
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Chart */}
                <SimpleBarChart
                  data={monthlyReport.staffPerformance.map((staff: any) => ({
                    label: staff.name,
                    value: staff.hours,
                    color: staff.staffType === 'permanent' ? '#3B82F6' : '#10B981'
                  }))}
                  title="Total Hours by Staff"
                  height={150}
                />
                
                {/* Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Shifts</TableHead>
                      <TableHead className="text-right">Avg/Shift</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyReport.staffPerformance.map((staff: any) => (
                      <TableRow key={staff.name}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{staff.name}</p>
                            <p className="text-sm text-muted-foreground capitalize">{staff.staffType}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium">
                            {formatHours(staff.hours)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-muted-foreground">
                            {staff.totalShifts}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-muted-foreground">
                            {staff.averageHoursPerShift}h
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shift Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Shift Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Day vs Night Shifts */}
              <div>
                <h4 className="text-sm font-medium mb-4">Day vs Night Shifts</h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Day Shifts</span>
                      <span className="text-sm font-medium">{monthlyReport.shiftDistribution.day}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ 
                          width: `${monthlyReport.shiftDistribution.total > 0
                            ? (monthlyReport.shiftDistribution.day / monthlyReport.shiftDistribution.total * 100)
                            : 0}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Night Shifts</span>
                      <span className="text-sm font-medium">{monthlyReport.shiftDistribution.night}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                        style={{ 
                          width: `${monthlyReport.shiftDistribution.total > 0
                            ? (monthlyReport.shiftDistribution.night / monthlyReport.shiftDistribution.total * 100)
                            : 0}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Staff Type Distribution */}
              <div>
                <h4 className="text-sm font-medium mb-4">By Staff Type</h4>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Permanent Staff</span>
                      <span className="text-sm font-medium">
                        {distributionReport.staffTypeDistribution.permanent.total} shifts
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Day: {distributionReport.staffTypeDistribution.permanent.day} |
                      Night: {distributionReport.staffTypeDistribution.permanent.night}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Temporary Staff</span>
                      <span className="text-sm font-medium">
                        {distributionReport.staffTypeDistribution.temporary.total} shifts
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Day: {distributionReport.staffTypeDistribution.temporary.day} |
                      Night: {distributionReport.staffTypeDistribution.temporary.night}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Weekly Distribution</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Chart */}
            <SimpleBarChart
              data={distributionReport.dayDistribution
                .filter((day: any) => day.total > 0)
                .map((day: any) => ({
                  label: day.dayName,
                  value: day.total,
                  color: '#6366F1'
                }))}
              title="Shifts by Day of Week"
              height={150}
            />
            
            {/* Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead className="text-center">Day Shifts</TableHead>
                  <TableHead className="text-center">Night Shifts</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distributionReport.dayDistribution.map((day: any) => (
                  <TableRow key={day.dayName}>
                    <TableCell>
                      <span className="font-medium">{day.dayName}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-blue-600 font-medium">{day.day}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-purple-600 font-medium">{day.night}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium">{day.total}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Reports;
