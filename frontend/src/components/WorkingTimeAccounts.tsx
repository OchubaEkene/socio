import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workingTimeAccountsAPI, staffAPI, schedulingAPI } from '../lib/api';
import { Clock, Plus, TrendingUp, Calculator, BarChart3, Calendar, User } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface WorkingTimeAccount {
  id: string;
  staffId: string;
  accountType: 'OVERTIME' | 'FLEX_TIME' | 'COMP_TIME' | 'VACATION_ACCOUNT' | 'SICK_LEAVE_ACCOUNT';
  balance: number;
  maxBalance?: number;
  minBalance?: number;
  year: number;
  month?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  staff: {
    id: string;
    name: string;
    email: string;
  };
  transactions: WorkingTimeTransaction[];
}

interface WorkingTimeTransaction {
  id: string;
  accountId: string;
  transactionType: 'CREDIT' | 'DEBIT';
  amount: number;
  description: string;
  referenceType?: string;
  referenceId?: string;
  recordedAt: string;
  recordedBy?: string;
  method: 'MANUAL' | 'AUTOMATIC' | 'SHYFTPLAN' | 'SAP_INTEGRATION' | 'API_INTEGRATION';
  notes?: string;
  recorder?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

const WorkingTimeAccounts: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [isCalculateDialogOpen, setIsCalculateDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<WorkingTimeAccount | null>(null);
  const [filters, setFilters] = useState({
    staffId: '',
    accountType: '',
    year: new Date().getFullYear().toString(),
    month: ''
  });

  // Fetch working time accounts
  const {
    data: accountsData,
    isLoading,
    error
  } = useQuery({
    queryKey: ['working-time-accounts', filters],
    queryFn: () => workingTimeAccountsAPI.getAll(filters),
  });

  // Fetch staff for dropdown
  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffAPI.getAll(),
  });

  // Fetch current week schedule for calculation
  const { data: scheduleData } = useQuery({
    queryKey: ['current-week-schedule'],
    queryFn: () => schedulingAPI.getCurrentWeekSchedule(),
  });

  // Mutations
  const createAccountMutation = useMutation({
    mutationFn: workingTimeAccountsAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['working-time-accounts'] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Success!",
        description: "Working time account created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create working time account.",
        variant: "destructive",
      });
    }
  });

  const addTransactionMutation = useMutation({
    mutationFn: ({ accountId, data }: { accountId: string; data: any }) =>
      workingTimeAccountsAPI.addTransaction(accountId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['working-time-accounts'] });
      setIsTransactionDialogOpen(false);
      setSelectedAccount(null);
      toast({
        title: "Success!",
        description: "Transaction added successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to add transaction.",
        variant: "destructive",
      });
    }
  });

  const calculateFromShiftMutation = useMutation({
    mutationFn: ({ accountId, shiftId }: { accountId: string; shiftId: string }) =>
      workingTimeAccountsAPI.calculateFromShift(accountId, shiftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['working-time-accounts'] });
      setIsCalculateDialogOpen(false);
      setSelectedAccount(null);
      toast({
        title: "Success!",
        description: "Hours calculated and recorded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to calculate hours from shift.",
        variant: "destructive",
      });
    }
  });

  const accounts = accountsData?.data?.accounts || [];
  const staff = staffData?.data?.staff || [];
  const shifts = scheduleData?.data?.data?.shifts || scheduleData?.data?.shifts || [];

  const getAccountTypeBadge = (type: string) => {
    const colors = {
      OVERTIME: 'bg-red-100 text-red-800',
      FLEX_TIME: 'bg-blue-100 text-blue-800',
      COMP_TIME: 'bg-green-100 text-green-800',
      VACATION_ACCOUNT: 'bg-purple-100 text-purple-800',
      SICK_LEAVE_ACCOUNT: 'bg-orange-100 text-orange-800'
    };

    return (
      <Badge className={colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {type.replace('_', ' ')}
      </Badge>
    );
  };

  const getBalanceColor = (balance: number, maxBalance?: number, minBalance?: number) => {
    if (maxBalance && balance >= maxBalance * 0.9) return 'text-red-600';
    if (minBalance && balance <= minBalance * 0.9) return 'text-orange-600';
    if (balance > 0) return 'text-green-600';
    return 'text-gray-600';
  };

  const getMethodBadge = (method: string) => {
    const colors = {
      MANUAL: 'bg-gray-100 text-gray-800',
      AUTOMATIC: 'bg-green-100 text-green-800',
      SHYFTPLAN: 'bg-blue-100 text-blue-800',
      SAP_INTEGRATION: 'bg-purple-100 text-purple-800',
      API_INTEGRATION: 'bg-orange-100 text-orange-800'
    };

    return (
      <Badge className={colors[method as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {method.replace('_', ' ')}
      </Badge>
    );
  };

  const handleCreateAccount = (formData: any) => {
    createAccountMutation.mutate(formData);
  };

  const handleAddTransaction = (accountId: string, formData: any) => {
    addTransactionMutation.mutate({ accountId, data: formData });
  };

  const handleCalculateFromShift = (accountId: string, shiftId: string) => {
    calculateFromShiftMutation.mutate({ accountId, shiftId });
  };

  // Calculate summary statistics
  const summary = {
    totalAccounts: accounts.length,
    totalBalance: accounts.reduce((sum: number, account: any) => sum + account.balance, 0),
    averageBalance: accounts.length > 0 ? accounts.reduce((sum: number, account: any) => sum + account.balance, 0) / accounts.length : 0,
    accountsByType: accounts.reduce((acc: any, account: any) => {
      if (!acc[account.accountType]) {
        acc[account.accountType] = { count: 0, totalBalance: 0 };
      }
      acc[account.accountType].count++;
      acc[account.accountType].totalBalance += account.balance;
      return acc;
    }, {} as any)
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-2xl">Working Time Accounts</CardTitle>
              <CardDescription>Manage staff working time accounts</CardDescription>
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
          <p className="text-red-600">Failed to load working time account data.</p>
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
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-2xl">Working Time Accounts</CardTitle>
                <CardDescription>Manage staff working time accounts and transactions</CardDescription>
              </div>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Account
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create Working Time Account</DialogTitle>
                  <DialogDescription>
                    Create a new working time account for a staff member.
                  </DialogDescription>
                </DialogHeader>
                <CreateAccountForm
                  staff={staff}
                  onSubmit={handleCreateAccount}
                  onCancel={() => setIsCreateDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-600">Total Accounts</span>
            </div>
            <p className="text-2xl font-bold">{summary.totalAccounts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-gray-600">Total Balance</span>
            </div>
            <p className="text-2xl font-bold">{summary.totalBalance.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-600">Average Balance</span>
            </div>
            <p className="text-2xl font-bold">{summary.averageBalance.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Calculator className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-gray-600">Active Accounts</span>
            </div>
            <p className="text-2xl font-bold">{accounts.filter((a: any) => a.isActive).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <Label htmlFor="account-type-filter">Account Type</Label>
              <Select value={filters.accountType} onValueChange={(value) => setFilters({ ...filters, accountType: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="OVERTIME">Overtime</SelectItem>
                  <SelectItem value="FLEX_TIME">Flex Time</SelectItem>
                  <SelectItem value="COMP_TIME">Comp Time</SelectItem>
                  <SelectItem value="VACATION_ACCOUNT">Vacation Account</SelectItem>
                  <SelectItem value="SICK_LEAVE_ACCOUNT">Sick Leave Account</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="year-filter">Year</Label>
              <Input
                type="number"
                value={filters.year}
                onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                min="2020"
                max="2030"
              />
            </div>
            <div>
              <Label htmlFor="month-filter">Month</Label>
              <Select value={filters.month} onValueChange={(value) => setFilters({ ...filters, month: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Months</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <SelectItem key={month} value={month.toString()}>
                      {format(new Date(2024, month - 1), 'MMMM')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card>
        <CardContent className="pt-6">
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts found</h3>
              <p className="text-gray-500">No working time accounts match your current filters.</p>
            </div>
          ) : (
            <Tabs defaultValue="accounts" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="accounts">Accounts</TabsTrigger>
                <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
              </TabsList>
              
              <TabsContent value="accounts">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Account Type</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account: WorkingTimeAccount) => (
                      <TableRow key={account.id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">{account.staff.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getAccountTypeBadge(account.accountType)}
                        </TableCell>
                        <TableCell>
                          <span className={cn("font-bold", getBalanceColor(account.balance, account.maxBalance, account.minBalance))}>
                            {account.balance.toFixed(1)}h
                          </span>
                          {account.maxBalance && (
                            <div className="text-xs text-gray-500">
                              Max: {account.maxBalance}h
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            <span>
                              {account.year}
                              {account.month && ` - ${format(new Date(2024, account.month - 1), 'MMM')}`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={account.isActive ? 'default' : 'secondary'}>
                            {account.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedAccount(account);
                                setIsTransactionDialogOpen(true);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Transaction
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedAccount(account);
                                setIsCalculateDialogOpen(true);
                              }}
                            >
                              <Calculator className="h-4 w-4 mr-1" />
                              Calculate
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
              
              <TabsContent value="transactions">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.flatMap((account: any) =>
                      account.transactions.map((transaction: any) => (
                        <TableRow key={transaction.id}>
                          <TableCell>{account.staff.name}</TableCell>
                          <TableCell>
                            <Badge variant={transaction.transactionType === 'CREDIT' ? 'default' : 'secondary'}>
                              {transaction.transactionType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className={cn("font-bold", transaction.transactionType === 'CREDIT' ? 'text-green-600' : 'text-red-600')}>
                              {transaction.transactionType === 'CREDIT' ? '+' : '-'}{transaction.amount.toFixed(1)}h
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs truncate" title={transaction.description}>
                              {transaction.description}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getMethodBadge(transaction.method)}
                          </TableCell>
                          <TableCell>
                            {format(new Date(transaction.recordedAt), 'MMM d, yyyy')}
                          </TableCell>
                        </TableRow>
                      ))
                    ).slice(0, 20)}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Transaction Dialog */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>
              Add a new transaction to {selectedAccount?.staff.name}'s {selectedAccount?.accountType.toLowerCase().replace('_', ' ')} account.
            </DialogDescription>
          </DialogHeader>
          <AddTransactionForm
            account={selectedAccount}
            onSubmit={(data) => selectedAccount && handleAddTransaction(selectedAccount.id, data)}
            onCancel={() => setIsTransactionDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Calculate from Shift Dialog */}
      <Dialog open={isCalculateDialogOpen} onOpenChange={setIsCalculateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calculate from Shift</DialogTitle>
            <DialogDescription>
              Calculate working time from a shift for {selectedAccount?.staff.name}'s {selectedAccount?.accountType.toLowerCase().replace('_', ' ')} account.
            </DialogDescription>
          </DialogHeader>
          <CalculateFromShiftForm
            account={selectedAccount}
            shifts={shifts.filter((s: any) => s.staffId === selectedAccount?.staffId)}
            onSubmit={(shiftId) => selectedAccount && handleCalculateFromShift(selectedAccount.id, shiftId)}
            onCancel={() => setIsCalculateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Create Account Form Component
interface CreateAccountFormProps {
  staff: any[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const CreateAccountForm: React.FC<CreateAccountFormProps> = ({ staff, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    staffId: '',
    accountType: 'OVERTIME' as const,
    year: new Date().getFullYear(),
    month: '',
    maxBalance: '',
    minBalance: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      year: parseInt(formData.year.toString()),
      month: formData.month ? parseInt(formData.month) : undefined,
      maxBalance: formData.maxBalance ? parseFloat(formData.maxBalance) : undefined,
      minBalance: formData.minBalance ? parseFloat(formData.minBalance) : undefined
    });
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
        <Label htmlFor="accountType">Account Type</Label>
        <Select value={formData.accountType} onValueChange={(value: any) => setFormData({ ...formData, accountType: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="OVERTIME">Overtime</SelectItem>
            <SelectItem value="FLEX_TIME">Flex Time</SelectItem>
            <SelectItem value="COMP_TIME">Comp Time</SelectItem>
            <SelectItem value="VACATION_ACCOUNT">Vacation Account</SelectItem>
            <SelectItem value="SICK_LEAVE_ACCOUNT">Sick Leave Account</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="year">Year</Label>
          <Input
            type="number"
            value={formData.year}
            onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
            min="2020"
            max="2030"
            required
          />
        </div>
        <div>
          <Label htmlFor="month">Month (Optional)</Label>
          <Select value={formData.month} onValueChange={(value) => setFormData({ ...formData, month: value })}>
            <SelectTrigger>
              <SelectValue placeholder="All year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All year</SelectItem>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <SelectItem key={month} value={month.toString()}>
                  {format(new Date(2024, month - 1), 'MMMM')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="maxBalance">Max Balance (Optional)</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.maxBalance}
            onChange={(e) => setFormData({ ...formData, maxBalance: e.target.value })}
            placeholder="e.g., 40.0"
          />
        </div>
        <div>
          <Label htmlFor="minBalance">Min Balance (Optional)</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.minBalance}
            onChange={(e) => setFormData({ ...formData, minBalance: e.target.value })}
            placeholder="e.g., -10.0"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Create Account
        </Button>
      </div>
    </form>
  );
};

// Add Transaction Form Component
interface AddTransactionFormProps {
  account: WorkingTimeAccount | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const AddTransactionForm: React.FC<AddTransactionFormProps> = ({ account, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    transactionType: 'CREDIT' as const,
    amount: '',
    description: '',
    method: 'MANUAL' as const,
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount)
    });
  };

  if (!account) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="transactionType">Transaction Type</Label>
        <Select value={formData.transactionType} onValueChange={(value: any) => setFormData({ ...formData, transactionType: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CREDIT">Credit</SelectItem>
            <SelectItem value="DEBIT">Debit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="amount">Amount (hours)</Label>
        <Input
          type="number"
          step="0.1"
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          placeholder="e.g., 8.5"
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe the transaction..."
          required
        />
      </div>

      <div>
        <Label htmlFor="method">Recording Method</Label>
        <Select value={formData.method} onValueChange={(value: any) => setFormData({ ...formData, method: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MANUAL">Manual</SelectItem>
            <SelectItem value="AUTOMATIC">Automatic</SelectItem>
            <SelectItem value="SHYFTPLAN">Shyftplan</SelectItem>
            <SelectItem value="SAP_INTEGRATION">SAP Integration</SelectItem>
            <SelectItem value="API_INTEGRATION">API Integration</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="notes">Notes (Optional)</Label>
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
          Add Transaction
        </Button>
      </div>
    </form>
  );
};

// Calculate from Shift Form Component
interface CalculateFromShiftFormProps {
  account: WorkingTimeAccount | null;
  shifts: any[];
  onSubmit: (shiftId: string) => void;
  onCancel: () => void;
}

const CalculateFromShiftForm: React.FC<CalculateFromShiftFormProps> = ({ account, shifts, onSubmit, onCancel }) => {
  const [selectedShiftId, setSelectedShiftId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedShiftId) {
      onSubmit(selectedShiftId);
    }
  };

  if (!account) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="shift">Select Shift</Label>
        <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a shift to calculate from" />
          </SelectTrigger>
          <SelectContent>
            {shifts.map((shift) => (
              <SelectItem key={shift.id} value={shift.id}>
                {format(new Date(shift.date), 'MMM d, yyyy')} - {shift.shiftType} shift
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {shifts.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          No shifts found for this staff member in the current week.
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!selectedShiftId || shifts.length === 0}>
          Calculate Hours
        </Button>
      </div>
    </form>
  );
};

export default WorkingTimeAccounts;
