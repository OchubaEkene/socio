import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { absencesAPI, staffAPI } from '../lib/api';
import { Calendar, User, AlertTriangle, CheckCircle, XCircle, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';

interface Absence {
  id: string;
  staffId: string;
  absenceType: 'SICK_LEAVE' | 'PERSONAL_LEAVE' | 'EMERGENCY' | 'OTHER';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  startDate: string;
  endDate: string;
  reason: string;
  notes?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  staff: {
    id: string;
    name: string;
    email: string;
  };
  approver?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

const AbsenceManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [selectedAbsence, setSelectedAbsence] = useState<Absence | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    staffId: '',
    startDate: '',
    endDate: ''
  });

  // Fetch absences
  const {
    data: absencesData,
    isLoading,
    error
  } = useQuery({
    queryKey: ['absences', filters],
    queryFn: () => absencesAPI.getAll(filters),
  });

  // Fetch staff for dropdown
  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.getAll(),
  });

  // Mutations
  const createAbsenceMutation = useMutation({
    mutationFn: absencesAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['absences'] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Success!",
        description: "Absence request created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create absence request.",
        variant: "destructive",
      });
    }
  });

  const approveAbsenceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: 'APPROVED' | 'REJECTED'; notes?: string } }) =>
      absencesAPI.approve(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['absences'] });
      setIsApprovalDialogOpen(false);
      setSelectedAbsence(null);
      toast({
        title: "Success!",
        description: "Absence request processed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to process absence request.",
        variant: "destructive",
      });
    }
  });

  const deleteAbsenceMutation = useMutation({
    mutationFn: absencesAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['absences'] });
      toast({
        title: "Success!",
        description: "Absence request cancelled successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to cancel absence request.",
        variant: "destructive",
      });
    }
  });

  const absences = absencesData?.data?.absences || [];
  const staff = staffData?.data?.staff || [];

  const getStatusBadge = (status: string) => {
    const variants = {
      PENDING: 'secondary',
      APPROVED: 'default',
      REJECTED: 'destructive',
      CANCELLED: 'outline'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  const getAbsenceTypeBadge = (type: string) => {
    const colors = {
      SICK_LEAVE: 'bg-red-100 text-red-800',
      PERSONAL_LEAVE: 'bg-blue-100 text-blue-800',
      EMERGENCY: 'bg-orange-100 text-orange-800',
      OTHER: 'bg-gray-100 text-gray-800'
    };

    return (
      <Badge className={colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {type.replace('_', ' ')}
      </Badge>
    );
  };

  const handleCreateAbsence = (formData: any) => {
    createAbsenceMutation.mutate(formData);
  };

  const handleApproveAbsence = (status: 'APPROVED' | 'REJECTED', notes?: string) => {
    if (selectedAbsence) {
      approveAbsenceMutation.mutate({
        id: selectedAbsence.id,
        data: { status, notes }
      });
    }
  };

  const handleDeleteAbsence = (id: string) => {
    if (confirm('Are you sure you want to cancel this absence request?')) {
      deleteAbsenceMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-2xl">Absence Management</CardTitle>
              <CardDescription>Manage staff absence requests</CardDescription>
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
        <CardHeader>
          <CardTitle className="text-2xl">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">Failed to load absence data.</p>
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
                <CardTitle className="text-2xl">Absence Management</CardTitle>
                <CardDescription>Manage staff absence requests and approvals</CardDescription>
              </div>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Absence Request
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create Absence Request</DialogTitle>
                  <DialogDescription>
                    Submit a new absence request for staff member.
                  </DialogDescription>
                </DialogHeader>
                <CreateAbsenceForm
                  staff={staff}
                  onSubmit={handleCreateAbsence}
                  onCancel={() => setIsCreateDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="staff-filter">Staff Member</Label>
              <Select value={filters.staffId} onValueChange={(value) => setFilters({ ...filters, staffId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All Staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Staff</SelectItem>
                  {staff.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Absences Table */}
      <Card>
        <CardContent className="pt-6">
          {absences.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No absences found</h3>
              <p className="text-gray-500">No absence requests match your current filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {absences.map((absence: Absence) => (
                  <TableRow key={absence.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{absence.staff.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getAbsenceTypeBadge(absence.absenceType)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span>
                          {format(new Date(absence.startDate), 'MMM d')} - {format(new Date(absence.endDate), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate" title={absence.reason}>
                        {absence.reason}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(absence.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {absence.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedAbsence(absence);
                                setIsApprovalDialogOpen(true);
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteAbsence(absence.id)}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Absence Request</DialogTitle>
            <DialogDescription>
              Approve or reject the absence request for {selectedAbsence?.staff.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add any notes about your decision..."
                id="approval-notes"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsApprovalDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const notes = (document.getElementById('approval-notes') as HTMLTextAreaElement)?.value;
                  handleApproveAbsence('REJECTED', notes);
                }}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={() => {
                  const notes = (document.getElementById('approval-notes') as HTMLTextAreaElement)?.value;
                  handleApproveAbsence('APPROVED', notes);
                }}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Create Absence Form Component
interface CreateAbsenceFormProps {
  staff: any[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const CreateAbsenceForm: React.FC<CreateAbsenceFormProps> = ({ staff, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    staffId: '',
    absenceType: 'SICK_LEAVE' as const,
    startDate: '',
    endDate: '',
    reason: '',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="staff">Staff Member</Label>
        <Select value={formData.staffId} onValueChange={(value) => setFormData({ ...formData, staffId: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select staff member" />
          </SelectTrigger>
          <SelectContent>
            {staff.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="absenceType">Absence Type</Label>
        <Select value={formData.absenceType} onValueChange={(value: any) => setFormData({ ...formData, absenceType: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SICK_LEAVE">Sick Leave</SelectItem>
            <SelectItem value="PERSONAL_LEAVE">Personal Leave</SelectItem>
            <SelectItem value="EMERGENCY">Emergency</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="endDate">End Date</Label>
          <Input
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="reason">Reason</Label>
        <Textarea
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          placeholder="Please provide a reason for the absence..."
          required
        />
      </div>

      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes..."
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Create Request
        </Button>
      </div>
    </form>
  );
};

export default AbsenceManagement;
