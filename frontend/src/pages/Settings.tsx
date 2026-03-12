import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { authAPI, contractsAPI, workingTimeAccountsAPI, vacationsAPI } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { UserCircle, KeyRound, FileText, BarChart3 } from 'lucide-react'
import { format, parseISO } from 'date-fns'

type Tab = 'profile' | 'contract' | 'balance'

export default function Settings() {
  const { user, updateProfile } = useAuth()
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('profile')

  const myStaffId = user?.staff?.id || user?.staffId

  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const updateProfileMutation = useMutation({
    mutationFn: () => updateProfile({ firstName: profileForm.firstName, lastName: profileForm.lastName }),
    onSuccess: () => toast({ title: 'Profile updated' }),
    onError: () => toast({ title: 'Failed to update profile', variant: 'destructive' }),
  })

  const changePasswordMutation = useMutation({
    mutationFn: () => authAPI.changePassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    }),
    onSuccess: () => {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      toast({ title: 'Password changed successfully' })
    },
    onError: (err: any) => {
      toast({ title: err.response?.data?.message || 'Failed to change password', variant: 'destructive' })
    },
  })

  const { data: contractsData } = useQuery({
    queryKey: ['my-contracts', myStaffId],
    queryFn: () => contractsAPI.getAll({ staffId: myStaffId, isActive: true }),
    enabled: !!myStaffId && tab === 'contract',
  })

  const { data: balanceData } = useQuery({
    queryKey: ['vacation-balance', myStaffId],
    queryFn: () => vacationsAPI.getBalance(myStaffId!),
    enabled: !!myStaffId && tab === 'balance',
  })

  const { data: workingTimeData } = useQuery({
    queryKey: ['working-time-summary', myStaffId],
    queryFn: () => workingTimeAccountsAPI.getStaffSummary(myStaffId!),
    enabled: !!myStaffId && tab === 'balance',
  })

  const contracts: any[] = contractsData?.data?.data?.contracts || contractsData?.data?.contracts || []
  const activeContract = contracts[0]
  const balanceByType: Record<string, { used: number; allowance: number; remaining: number }> =
    balanceData?.data?.data?.balanceByType || balanceData?.data?.balanceByType || {}
  const workingAccounts: any[] = workingTimeData?.data?.data?.accounts || workingTimeData?.data?.accounts || []

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: 'New passwords do not match', variant: 'destructive' })
      return
    }
    if (passwordForm.newPassword.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' })
      return
    }
    changePasswordMutation.mutate()
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: 'profile', label: 'Profile', icon: <UserCircle className="h-4 w-4" />, show: true },
    { id: 'contract', label: 'My Contract', icon: <FileText className="h-4 w-4" />, show: !!myStaffId },
    { id: 'balance', label: 'My Balance', icon: <BarChart3 className="h-4 w-4" />, show: !!myStaffId },
  ]

  return (
    <div className="section-spacing max-w-2xl">
      {/* Tab nav */}
      <div className="flex space-x-1 border-b mb-6">
        {tabs.filter(t => t.show).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <UserCircle className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>My Profile</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4 pb-4 border-b">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-xl font-semibold text-muted-foreground">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                <div>
                  <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant={user?.role === 'admin' ? 'default' : user?.role === 'manager' ? 'secondary' : 'outline'}>
                      {user?.role}
                    </Badge>
                    {user?.staff && (
                      <Badge variant="outline">Staff: {user.staff.name}</Badge>
                    )}
                  </div>
                </div>
              </div>

              <form onSubmit={e => { e.preventDefault(); updateProfileMutation.mutate() }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>First Name</Label>
                    <Input value={profileForm.firstName} onChange={e => setProfileForm(f => ({ ...f, firstName: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label>Last Name</Label>
                    <Input value={profileForm.lastName} onChange={e => setProfileForm(f => ({ ...f, lastName: e.target.value }))} required />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input value={user?.email || ''} disabled className="bg-muted" />
                </div>
                <div className="space-y-1">
                  <Label>Username</Label>
                  <Input value={user?.username || ''} disabled className="bg-muted" />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={updateProfileMutation.isPending}>
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <KeyRound className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Change Password</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label>Current Password</Label>
                  <Input type="password" value={passwordForm.currentPassword} onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <Label>New Password</Label>
                  <Input type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))} required minLength={6} />
                </div>
                <div className="space-y-1">
                  <Label>Confirm New Password</Label>
                  <Input type="password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))} required />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={changePasswordMutation.isPending}>
                    {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'contract' && (
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>My Contract</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {!myStaffId ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 text-sm">Your account is not linked to a staff record. Ask your manager to link it.</p>
              </div>
            ) : !activeContract ? (
              <p className="text-sm text-muted-foreground">No active contract found.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{activeContract.contractType}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(activeContract.startDate), 'MMM d, yyyy')}
                      {activeContract.endDate ? ` – ${format(parseISO(activeContract.endDate), 'MMM d, yyyy')}` : ' (ongoing)'}
                    </p>
                  </div>
                  <Badge variant={activeContract.isActive ? 'default' : 'secondary'}>
                    {activeContract.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  {activeContract.position && (
                    <div>
                      <p className="text-muted-foreground">Position</p>
                      <p className="font-medium">{activeContract.position}</p>
                    </div>
                  )}
                  {activeContract.department && (
                    <div>
                      <p className="text-muted-foreground">Department</p>
                      <p className="font-medium">{activeContract.department}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Hours / Week</p>
                    <p className="font-medium">{activeContract.workingHoursPerWeek}h</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Notice Period</p>
                    <p className="font-medium">{activeContract.noticePeriod} days</p>
                  </div>
                  {activeContract.probationEndDate && (
                    <div>
                      <p className="text-muted-foreground">Probation Ends</p>
                      <p className="font-medium">{format(parseISO(activeContract.probationEndDate), 'MMM d, yyyy')}</p>
                    </div>
                  )}
                  {activeContract.salary != null && (
                    <div>
                      <p className="text-muted-foreground">Salary</p>
                      <p className="font-medium">{activeContract.salary.toLocaleString()} {activeContract.currency || 'EUR'}</p>
                    </div>
                  )}
                </div>

                {activeContract.qualifications?.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Qualifications</p>
                    <div className="flex flex-wrap gap-2">
                      {activeContract.qualifications.map((q: string) => (
                        <Badge key={q} variant="outline" className="text-xs">{q}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {activeContract.benefits?.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Benefits</p>
                    <div className="flex flex-wrap gap-2">
                      {activeContract.benefits.map((b: string) => (
                        <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'balance' && (
        <div className="space-y-4">
          {/* Vacation balance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vacation Balance ({new Date().getFullYear()})</CardTitle>
            </CardHeader>
            <CardContent>
              {!myStaffId ? (
                <p className="text-sm text-muted-foreground">Account not linked to a staff record.</p>
              ) : Object.keys(balanceByType).length === 0 ? (
                <p className="text-sm text-muted-foreground">No vacation policies configured for your staff type.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(balanceByType).map(([type, bal]) => (
                    <div key={type} className="border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">{type}</p>
                      <div className="flex items-end justify-between">
                        <p className="text-2xl font-bold text-primary">{bal.remaining}</p>
                        <p className="text-sm text-muted-foreground">/ {bal.allowance} days</p>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: bal.allowance > 0 ? `${Math.min(100, (bal.remaining / bal.allowance) * 100)}%` : '0%' }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{bal.used} used</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Working time accounts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Working Time Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              {!myStaffId ? (
                <p className="text-sm text-muted-foreground">Account not linked to a staff record.</p>
              ) : workingAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No working time accounts found.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {workingAccounts.map((acc: any) => (
                    <div key={acc.id} className="border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">{acc.accountType}</p>
                      <p className="text-xs text-muted-foreground mb-1">{acc.year}{acc.month ? `/${acc.month}` : ''}</p>
                      <p className={`text-2xl font-bold ${acc.balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {acc.balance > 0 ? '+' : ''}{acc.balance}h
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
