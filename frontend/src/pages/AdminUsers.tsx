import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authAPI, staffAPI } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ShieldCheck, Link } from 'lucide-react'
import { format } from 'date-fns'

const ROLE_BADGE: Record<string, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  manager: 'secondary',
  staff: 'outline',
}

export default function AdminUsers() {
  const { user: currentUser, isAdmin } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [linkingUser, setLinkingUser] = useState<any>(null)
  const [selectedStaffId, setSelectedStaffId] = useState('')

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: authAPI.getUsers,
  })

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.getAll(),
    enabled: isAdmin(),
  })

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'manager' | 'staff' }) =>
      authAPI.changeUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Role updated' })
    },
    onError: (err: any) => {
      toast({ title: err.response?.data?.message || 'Failed to update role', variant: 'destructive' })
    },
  })

  const linkMutation = useMutation({
    mutationFn: ({ userId, staffId }: { userId: string; staffId: string | null }) =>
      authAPI.linkStaffToUser(userId, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setLinkingUser(null)
      setSelectedStaffId('')
      toast({ title: 'Staff record updated' })
    },
    onError: (err: any) => {
      toast({ title: err.response?.data?.message || 'Failed to update link', variant: 'destructive' })
    },
  })

  const users = usersData?.data?.data?.users || usersData?.data?.users || []
  const allStaff: any[] = staffData?.data?.staff || []

  if (!isAdmin()) {
    return (
      <div className="section-spacing">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Admin access required.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="section-spacing">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>User Management</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Username</th>
                    <th className="pb-2 pr-4">Linked Staff</th>
                    <th className="pb-2 pr-4">Joined</th>
                    <th className="pb-2 pr-4">Role</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">
                        {u.firstName} {u.lastName}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{u.email}</td>
                      <td className="py-3 pr-4 text-muted-foreground">@{u.username}</td>
                      <td className="py-3 pr-4">
                        {u.staff ? (
                          <Badge variant="outline">{u.staff.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {format(new Date(u.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="py-3 pr-4">
                        {u.id === currentUser?.id ? (
                          <Badge variant={ROLE_BADGE[u.role] || 'outline'}>{u.role}</Badge>
                        ) : (
                          <Select
                            value={u.role}
                            onValueChange={role => roleMutation.mutate({ userId: u.id, role: role as any })}
                          >
                            <SelectTrigger className="w-28 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">admin</SelectItem>
                              <SelectItem value="manager">manager</SelectItem>
                              <SelectItem value="staff">staff</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Link staff record"
                          onClick={() => { setLinkingUser(u); setSelectedStaffId(u.staffId || '') }}
                        >
                          <Link className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link Staff Modal */}
      <Dialog open={!!linkingUser} onOpenChange={open => !open && setLinkingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link Staff Record</DialogTitle>
          </DialogHeader>
          {linkingUser && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Linking a staff record to <strong>{linkingUser.firstName} {linkingUser.lastName}</strong> lets them see their own schedule, absences, and time records.
              </p>
              <div className="space-y-1">
                <Label>Staff Record</Label>
                <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff record" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unlink__">— Remove link —</SelectItem>
                    {allStaff
                      .filter((s: any) => !s.user || s.user?.id === linkingUser.id)
                      .map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.staffType})</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setLinkingUser(null)}>Cancel</Button>
                <Button
                  disabled={!selectedStaffId || linkMutation.isPending}
                  onClick={() => {
                    if (selectedStaffId === '__unlink__') {
                      linkMutation.mutate({ userId: linkingUser.id, staffId: null })
                    } else {
                      linkMutation.mutate({ userId: linkingUser.id, staffId: selectedStaffId })
                    }
                  }}
                >
                  {linkMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
