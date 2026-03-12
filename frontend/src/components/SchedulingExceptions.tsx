import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schedulingExceptionsAPI } from '../lib/api';
import { AlertTriangle, CheckCircle, Clock, User, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface SchedulingException {
  id: string;
  shiftId?: string;
  ruleId: string;
  message: string;
  isResolved: boolean;
  createdAt: string;
  shift?: {
    id: string;
    staff: {
      id: string;
      name: string;
    };
  };
  rule: {
    id: string;
    name: string;
    shiftType: 'day' | 'night';
    dayOfWeek: string;
  };
}

const SchedulingExceptions: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: exceptionsData,
    isLoading,
    error
  } = useQuery({
    queryKey: ['scheduling-exceptions', 'unresolved'],
    queryFn: () => schedulingExceptionsAPI.getUnresolved(),
  });

  const resolveMutation = useMutation({
    mutationFn: schedulingExceptionsAPI.resolve,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduling-exceptions'] });
      toast({
        title: "Success!",
        description: "Exception marked as resolved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to resolve exception. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleResolve = (exceptionId: string) => {
    resolveMutation.mutate(exceptionId);
  };

  const exceptions = exceptionsData?.data?.exceptions || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-2xl">Scheduling Exceptions</CardTitle>
              <CardDescription>Review and resolve scheduling conflicts</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-muted rounded-full animate-pulse"></div>
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-1/3 animate-pulse"></div>
                  <div className="h-3 bg-muted rounded w-1/4 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="p-2 bg-destructive/10 rounded-lg w-fit mx-auto mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <h3 className="text-lg font-medium text-destructive mb-2">
              Failed to load scheduling exceptions
            </h3>
            <p className="text-muted-foreground">
              Please try refreshing the page or contact support.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-2xl">Scheduling Exceptions</CardTitle>
                <CardDescription>Review and resolve scheduling conflicts</CardDescription>
              </div>
            </div>
            {exceptions.length > 0 && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                {exceptions.length} unresolved
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Exceptions List */}
      {exceptions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <div className="p-2 bg-green-100 rounded-lg w-fit mx-auto mb-4">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-green-900 mb-2">
                No unresolved exceptions
              </h3>
              <p className="text-muted-foreground">
                All scheduling rules have been satisfied
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.map((exception: SchedulingException) => (
                  <TableRow key={exception.id} className="border-orange-200">
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <span className="font-medium">{exception.rule.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm text-muted-foreground truncate">
                        {exception.message}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {exception.rule.dayOfWeek}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={exception.rule.shiftType === 'day' ? 'default' : 'secondary'}
                        className="capitalize"
                      >
                        {exception.rule.shiftType} shift
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {exception.shift ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-sm">{exception.shift.staff.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {new Date(exception.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() => handleResolve(exception.id)}
                        disabled={resolveMutation.isPending}
                        size="sm"
                        variant="outline"
                        className="border-orange-200 text-orange-700 hover:bg-orange-50"
                      >
                        {resolveMutation.isPending ? 'Resolving...' : 'Resolve'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SchedulingExceptions;
