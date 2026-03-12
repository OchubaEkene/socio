import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { staffAPI } from '@/lib/api'
import { Plus, User, Calendar, Clock, Users } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface Staff {
  id: string
  name: string
  gender: 'male' | 'female'
  staffType: 'permanent' | 'temporary'
  createdAt: string
  _count: {
    availabilities: number
    shifts: number
  }
}

function StaffList() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    gender: '',
    staffType: ''
  })
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Fetch staff data
  const {
    data: staffData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.getAll(),
  })

  // Create staff mutation
  const createStaffMutation = useMutation({
    mutationFn: staffAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setIsModalOpen(false)
      setFormData({ name: '', gender: '', staffType: '' })
      toast({
        title: "Success!",
        description: "Staff member added successfully.",
      })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add staff member. Please try again.",
        variant: "destructive",
      })
    }
  })

  // Handle form submission
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!formData.name || !formData.gender || !formData.staffType) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    createStaffMutation.mutate({ 
      name: formData.name, 
      gender: formData.gender as 'male' | 'female', 
      staffType: formData.staffType as 'permanent' | 'temporary' 
    })
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="section-spacing">
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Staff Members</CardTitle>
                <CardDescription>Manage your team members and their information</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="skeleton-avatar"></div>
                  <div className="space-y-2 flex-1">
                    <div className="skeleton-text w-1/3"></div>
                    <div className="skeleton-text w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="empty-state">
            <div className="empty-state-icon">
              <Users className="h-12 w-12" />
            </div>
            <h3 className="empty-state-title">Failed to load staff members</h3>
            <p className="empty-state-description">
              Please try refreshing the page or contact support.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const staff = staffData?.data?.staff || []

  return (
    <div className="section-spacing">
      {/* Professional Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Staff Members</CardTitle>
                <CardDescription>Manage your team members and their information</CardDescription>
              </div>
            </div>
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Add New Staff</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Staff Member</DialogTitle>
                  <DialogDescription>
                    Enter the details for the new staff member. All fields are required.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="form-group">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter staff member's full name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <Label htmlFor="gender">Gender *</Label>
                    <Select value={formData.gender} onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="form-group">
                    <Label htmlFor="staffType">Staff Type *</Label>
                    <Select value={formData.staffType} onValueChange={(value) => setFormData(prev => ({ ...prev, staffType: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select staff type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="permanent">Permanent</SelectItem>
                        <SelectItem value="temporary">Temporary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createStaffMutation.isPending}
                      className="flex-1"
                    >
                      {createStaffMutation.isPending ? 'Adding...' : 'Add Staff Member'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Staff List */}
      {staff.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="empty-state">
              <div className="empty-state-icon">
                <User className="h-12 w-12" />
              </div>
              <h3 className="empty-state-title">No staff members yet</h3>
              <p className="empty-state-description">
                Get started by adding your first staff member.
              </p>
              <Button onClick={() => setIsModalOpen(true)} className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Add First Staff Member</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead className="text-center">Availabilities</TableHead>
                  <TableHead className="text-center">Shifts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member: Staff) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{member.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Added {new Date(member.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={member.staffType === 'permanent' ? 'default' : 'secondary'}
                        className={cn(
                          member.staffType === 'permanent' 
                            ? 'status-success' 
                            : 'status-warning'
                        )}
                      >
                        {member.staffType}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{member.gender}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{member._count.availabilities}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{member._count.shifts}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default StaffList
