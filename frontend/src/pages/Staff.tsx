import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { staffAPI } from '@/lib/api'
import { Plus, Edit, Trash2, Eye, Users, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'

interface Staff {
  id: string
  name: string
  email?: string
  gender: 'male' | 'female'
  staffType: 'permanent' | 'temporary'
  createdAt: string
  _count: {
    availabilities: number
    shifts: number
  }
}

function Staff() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [createQuals, setCreateQuals] = useState('')
  const [editQuals, setEditQuals] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { isManager, isAdmin } = useAuth()

  const {
    data: staffData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['staff', search, typeFilter],
    queryFn: () => staffAPI.getAll({ search: search || undefined, staffType: typeFilter !== 'all' ? typeFilter : undefined }),
  })

  const createStaffMutation = useMutation({
    mutationFn: staffAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setIsCreateModalOpen(false)
      toast.success('Staff member created successfully')
    },
    onError: (error: any) => {
      console.error('Staff creation error:', error)
      console.error('Error response:', error.response?.data)
      const errorMessage = error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || 'Failed to create staff member'
      toast.error(errorMessage)
    }
  })

  const updateStaffMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => staffAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setEditingStaff(null)
      toast.success('Staff member updated successfully')
    },
    onError: (error: any) => {
      console.error('Staff update error:', error)
      const errorMessage = error.response?.data?.message || 'Failed to update staff member'
      toast.error(errorMessage)
    }
  })

  const deleteStaffMutation = useMutation({
    mutationFn: staffAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      toast.success('Staff member deleted successfully')
    },
    onError: (error: any) => {
      console.error('Staff deletion error:', error)
      const errorMessage = error.response?.data?.message || 'Failed to delete staff member'
      toast.error(errorMessage)
    }
  })

  const handleCreateStaff = (formData: FormData) => {
    const name = formData.get('name') as string
    const gender = formData.get('gender') as 'male' | 'female'
    const staffType = formData.get('staffType') as 'permanent' | 'temporary'
    const email = formData.get('email') as string

    // Validate required fields
    if (!name || !gender || !staffType) {
      toast.error('Please fill in all required fields')
      return
    }

    // Check for empty string values
    if (name.trim() === '' || gender.trim() === '' || staffType.trim() === '') {
      toast.error('Please fill in all required fields')
      return
    }

    const qualifications = createQuals.split(',').map(q => q.trim()).filter(Boolean)
    const maxHoursPerWeek = formData.get('maxHoursPerWeek') as string
    createStaffMutation.mutate({ name, gender, staffType, email, qualifications, maxHoursPerWeek: maxHoursPerWeek ? parseInt(maxHoursPerWeek) : null })
  }

  const handleUpdateStaff = (formData: FormData) => {
    if (!editingStaff) return

    const name = formData.get('name') as string
    const gender = formData.get('gender') as 'male' | 'female'
    const staffType = formData.get('staffType') as 'permanent' | 'temporary'
    const email = formData.get('email') as string

    const qualifications = editQuals.split(',').map(q => q.trim()).filter(Boolean)
    const maxHoursPerWeek = formData.get('maxHoursPerWeek') as string
    updateStaffMutation.mutate({
      id: editingStaff.id,
      data: { name, gender, staffType, email, qualifications, maxHoursPerWeek: maxHoursPerWeek ? parseInt(maxHoursPerWeek) : null }
    })
  }

  const handleDeleteStaff = (id: string) => {
    setPendingDeleteId(id)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="card">
                <div className="card-content">
                  <div className="h-4 bg-gray-300 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Something went wrong
        </h3>
        <p className="text-gray-600">
          Unable to load staff members. Please try again later.
        </p>
      </div>
    )
  }

  const staff = staffData?.data?.staff || []

    return (
    <div className="section-spacing">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Users className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
        </div>
        {(isManager() || isAdmin()) && (
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Staff Member</span>
          </Button>
        )}
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="permanent">Permanent</SelectItem>
            <SelectItem value="temporary">Temporary</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {staff.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No staff members yet
            </h3>
            <p className="text-gray-600 mb-4">
              Add your first staff member to get started.
            </p>
            {(isManager() || isAdmin()) && (
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Staff Member
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {staff.map((member: Staff) => (
            <Card key={member.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{member.name}</CardTitle>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/staff/${member.id}`)}
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {(isManager() || isAdmin()) && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditingStaff(member); setEditQuals((member as any).qualifications?.join(', ') || '') }}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
<Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStaff(member.id)}
                          title="Delete"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Gender:</span>
                    <span className="text-sm font-medium capitalize">
                      {member.gender}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Type:</span>
                    <Badge variant={member.staffType === 'permanent' ? 'default' : 'secondary'}>
                      {member.staffType}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Availabilities:</span>
                    <span className="text-sm font-medium">
                      {member._count.availabilities}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Shifts:</span>
                    <span className="text-sm font-medium">
                      {member._count.shifts}
                    </span>
                  </div>
                  {(member as any).maxHoursPerWeek != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Max hrs/week:</span>
                      <span className="text-sm font-medium">{(member as any).maxHoursPerWeek}h</span>
                    </div>
                  )}
                  {(member as any)._count?.absences > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Absences:</span>
                      <Badge variant="outline" className="text-xs">{(member as any)._count.absences}</Badge>
                    </div>
                  )}
                  {(member as any).qualifications?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(member as any).qualifications.map((q: string) => (
                        <span key={q} className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded">{q}</span>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

            {/* Create Staff Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault()
            handleCreateStaff(new FormData(e.currentTarget))
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="Enter staff name"
                />
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select name="gender" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="staffType">Staff Type</Label>
                <Select name="staffType" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanent">Permanent</SelectItem>
                    <SelectItem value="temporary">Temporary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <Label htmlFor="create-quals">Qualifications (comma-separated)</Label>
                <Input
                  id="create-quals"
                  value={createQuals}
                  onChange={e => setCreateQuals(e.target.value)}
                  placeholder="e.g. First Aid, Forklift, Management"
                />
              </div>
              <div>
                <Label htmlFor="create-maxHours">Max Hours / Week (Optional)</Label>
                <Input
                  id="create-maxHours"
                  name="maxHoursPerWeek"
                  type="number"
                  min={1}
                  max={168}
                  placeholder="e.g. 40"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsCreateModalOpen(false); setCreateQuals('') }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createStaffMutation.isPending}
                className="flex-1"
              >
                {createStaffMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

            {/* Edit Staff Modal */}
      <Dialog open={!!editingStaff} onOpenChange={(open) => !open && setEditingStaff(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
          </DialogHeader>
          {editingStaff && (
            <form onSubmit={(e) => {
              e.preventDefault()
              handleUpdateStaff(new FormData(e.currentTarget))
            }}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    type="text"
                    required
                    defaultValue={editingStaff.name}
                    placeholder="Enter staff name"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-gender">Gender</Label>
                  <Select name="gender" required defaultValue={editingStaff.gender}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-staffType">Staff Type</Label>
                  <Select name="staffType" required defaultValue={editingStaff.staffType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Permanent</SelectItem>
                      <SelectItem value="temporary">Temporary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-email">Email (Optional)</Label>
                  <Input
                    id="edit-email"
                    name="email"
                    type="email"
                    defaultValue={editingStaff.email || ''}
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-quals">Qualifications (comma-separated)</Label>
                  <Input
                    id="edit-quals"
                    value={editQuals}
                    onChange={e => setEditQuals(e.target.value)}
                    placeholder="e.g. First Aid, Forklift, Management"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-maxHours">Max Hours / Week (Optional)</Label>
                  <Input
                    id="edit-maxHours"
                    name="maxHoursPerWeek"
                    type="number"
                    min={1}
                    max={168}
                    defaultValue={(editingStaff as any)?.maxHoursPerWeek ?? ''}
                    placeholder="e.g. 40"
                  />
                </div>
              </div>
              <div className="flex space-x-3 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingStaff(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateStaffMutation.isPending}
                  className="flex-1"
                >
                  {updateStaffMutation.isPending ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDeleteId} onOpenChange={o => !o && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete staff member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive the staff member and remove them from future scheduling. This action can be undone by an admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteStaffMutation.mutate(pendingDeleteId!); setPendingDeleteId(null) }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Staff
