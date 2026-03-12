import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workingTimeAccountsAPI, staffAPI } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Plus, Clock, ChevronDown, ChevronRight } from 'lucide-react'
import Pagination from '@/components/Pagination'

const PAGE_SIZE = 15
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

const ACCOUNT_TYPES = ['OVERTIME', 'FLEX_TIME', 'COMP_TIME', 'VACATION_ACCOUNT', 'SICK_LEAVE_ACCOUNT'] as const
const TRANSACTION_TYPES = ['CREDIT', 'DEBIT'] as const

function accountTypeLabel(t: string) {
  return t.replace(/_/g, ' ')
}

export default function WorkingTimeAccountsPage() {
  const { user, isManager, isAdmin } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isManagerOrAdmin = isManager() || isAdmin()

  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false)
  const [isAddTxOpen, setIsAddTxOpen] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null)
  const [staffFilter, setStaffFilter] = useState(user?.staffId || '')
  const [page, setPage] = useState(1)

  const [accountForm, setAccountForm] = useState({
    staffId: user?.staffId || '',
    accountType: 'OVERTIME' as typeof ACCOUNT_TYPES[number],
    year: new Date().getFullYear(),
    month: '',
    maxBalance: '',
    minBalance: '',
  })

  const [txForm, setTxForm] = useState({
    transactionType: 'CREDIT' as 'CREDIT' | 'DEBIT',
    amount: '',
    description: '',
    notes: '',
  })

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['working-time-accounts', staffFilter],
    queryFn: () => workingTimeAccountsAPI.getAll({ ...(staffFilter && { staffId: staffFilter }) }),
  })

  const { data: txData } = useQuery({
    queryKey: ['wta-transactions', expandedAccount],
    queryFn: () => workingTimeAccountsAPI.getTransactions(expandedAccount!),
    enabled: !!expandedAccount,
  })

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.getAll(),
    enabled: isManagerOrAdmin,
  })

  const createAccountMutation = useMutation({
    mutationFn: workingTimeAccountsAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['working-time-accounts'] })
      setIsCreateAccountOpen(false)
      setAccountForm({ staffId: user?.staffId || '', accountType: 'OVERTIME', year: new Date().getFullYear(), month: '', maxBalance: '', minBalance: '' })
      toast({ title: 'Account created' })
    },
    onError: (err: any) => {
      toast({ title: err.response?.data?.message || 'Failed to create account', variant: 'destructive' })
    },
  })

  const addTxMutation = useMutation({
    mutationFn: ({ accountId, data }: { accountId: string; data: any }) =>
      workingTimeAccountsAPI.addTransaction(accountId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wta-transactions', selectedAccountId] })
      queryClient.invalidateQueries({ queryKey: ['working-time-accounts'] })
      setIsAddTxOpen(false)
      setTxForm({ transactionType: 'CREDIT', amount: '', description: '', notes: '' })
      toast({ title: 'Transaction added' })
    },
    onError: (err: any) => {
      toast({ title: err.response?.data?.message || 'Failed to add transaction', variant: 'destructive' })
    },
  })

  const allAccounts = accountsData?.data?.accounts || []
  const totalPages = Math.ceil(allAccounts.length / PAGE_SIZE)
  const accounts = allAccounts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const allStaff = staffData?.data?.staff || []
  const transactions = txData?.data?.transactions || []

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault()
    createAccountMutation.mutate({
      staffId: accountForm.staffId,
      accountType: accountForm.accountType,
      year: accountForm.year,
      ...(accountForm.month && { month: parseInt(accountForm.month) }),
      ...(accountForm.maxBalance && { maxBalance: parseFloat(accountForm.maxBalance) }),
      ...(accountForm.minBalance && { minBalance: parseFloat(accountForm.minBalance) }),
    })
  }

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAccountId) return
    addTxMutation.mutate({
      accountId: selectedAccountId,
      data: {
        transactionType: txForm.transactionType,
        amount: parseFloat(txForm.amount),
        description: txForm.description,
        ...(txForm.notes && { notes: txForm.notes }),
      },
    })
  }

  return (
    <div className="section-spacing">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Working Time Accounts</CardTitle>
            </div>
            {isManagerOrAdmin && (
              <Button onClick={() => setIsCreateAccountOpen(true)} className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>New Account</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Staff filter for managers */}
          {isManagerOrAdmin && (
            <div className="flex items-center space-x-3 mb-6">
              <Label>Staff:</Label>
              <Select value={staffFilter} onValueChange={v => { setStaffFilter(v); setPage(1) }}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All staff</SelectItem>
                  {allStaff.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : allAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No working time accounts found.</p>
          ) : (
            <div className="space-y-3">
              {accounts.map((account: any) => (
                <div key={account.id} className="border rounded-lg overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
                    onClick={() => setExpandedAccount(expandedAccount === account.id ? null : account.id)}
                  >
                    <div className="flex items-center space-x-4">
                      {expandedAccount === account.id
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      }
                      <div>
                        <p className="font-medium">{account.staff?.name || account.staffId}</p>
                        <p className="text-xs text-muted-foreground">
                          {accountTypeLabel(account.accountType)} · {account.year}
                          {account.month ? `/${String(account.month).padStart(2, '0')}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Balance</p>
                        <p className={`font-bold ${(account.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(account.balance || 0) >= 0 ? '+' : ''}{account.balance ?? 0}h
                        </p>
                      </div>
                      {isManagerOrAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedAccountId(account.id)
                            setIsAddTxOpen(true)
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Entry
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded transaction list */}
                  {expandedAccount === account.id && (
                    <div className="border-t bg-muted/10 px-4 py-3">
                      {transactions.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">No transactions yet.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-muted-foreground border-b">
                              <th className="pb-2 pr-4">Date</th>
                              <th className="pb-2 pr-4">Type</th>
                              <th className="pb-2 pr-4">Amount</th>
                              <th className="pb-2">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactions.map((tx: any) => (
                              <tr key={tx.id} className="border-b last:border-0">
                                <td className="py-2 pr-4 text-muted-foreground">
                                  {new Date(tx.recordedAt).toLocaleDateString()}
                                </td>
                                <td className="py-2 pr-4">
                                  <Badge variant={tx.transactionType === 'CREDIT' ? 'default' : 'destructive'}>
                                    {tx.transactionType}
                                  </Badge>
                                </td>
                                <td className={`py-2 pr-4 font-medium ${tx.transactionType === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                                  {tx.transactionType === 'CREDIT' ? '+' : '-'}{tx.amount}h
                                </td>
                                <td className="py-2 text-muted-foreground">{tx.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </CardContent>
      </Card>

      {/* Create Account Modal */}
      <Dialog open={isCreateAccountOpen} onOpenChange={setIsCreateAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Working Time Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div className="space-y-1">
              <Label>Staff Member</Label>
              <Select value={accountForm.staffId} onValueChange={v => setAccountForm(f => ({ ...f, staffId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {allStaff.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Account Type</Label>
              <Select value={accountForm.accountType} onValueChange={v => setAccountForm(f => ({ ...f, accountType: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{accountTypeLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Year</Label>
                <Input
                  type="number"
                  value={accountForm.year}
                  onChange={e => setAccountForm(f => ({ ...f, year: parseInt(e.target.value) }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Month (optional)</Label>
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={accountForm.month}
                  onChange={e => setAccountForm(f => ({ ...f, month: e.target.value }))}
                  placeholder="1–12"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Max Balance (h)</Label>
                <Input
                  type="number"
                  value={accountForm.maxBalance}
                  onChange={e => setAccountForm(f => ({ ...f, maxBalance: e.target.value }))}
                  placeholder="optional"
                />
              </div>
              <div className="space-y-1">
                <Label>Min Balance (h)</Label>
                <Input
                  type="number"
                  value={accountForm.minBalance}
                  onChange={e => setAccountForm(f => ({ ...f, minBalance: e.target.value }))}
                  placeholder="optional"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateAccountOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createAccountMutation.isPending}>
                {createAccountMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Transaction Modal */}
      <Dialog open={isAddTxOpen} onOpenChange={setIsAddTxOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Time Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddTransaction} className="space-y-4">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={txForm.transactionType} onValueChange={v => setTxForm(f => ({ ...f, transactionType: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Amount (hours)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={txForm.amount}
                onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))}
                required
                placeholder="e.g. 2.5"
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input
                value={txForm.description}
                onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))}
                required
                placeholder="e.g. Overtime Monday shift"
              />
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Input
                value={txForm.notes}
                onChange={e => setTxForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsAddTxOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addTxMutation.isPending}>
                {addTxMutation.isPending ? 'Adding...' : 'Add Entry'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
