import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  register: (data: {
    email: string
    username: string
    password: string
    firstName?: string
    lastName?: string
    role?: string
  }) => api.post('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),

  getProfile: () => api.get('/auth/me'),

  updateProfile: (data: {
    firstName?: string
    lastName?: string
    bio?: string
    avatar?: string
  }) => api.put('/auth/me', data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.patch('/auth/change-password', data),

  getUsers: () => api.get('/auth/users'),

  linkStaffToUser: (userId: string, staffId: string | null) =>
    api.patch(`/auth/users/${userId}/link-staff`, { staffId }),

  changeUserRole: (userId: string, role: 'admin' | 'manager' | 'staff') =>
    api.patch(`/auth/users/${userId}/role`, { role }),

  googleLogin: (data: { credential: string; role?: string }) =>
    api.post('/auth/google', data),
}

// Time Records API
export const timeRecordsAPI = {
  getAll: (params?: { staffId?: string; startDate?: string; endDate?: string; isApproved?: boolean; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.staffId) searchParams.append('staffId', params.staffId);
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    if (params?.isApproved !== undefined) searchParams.append('isApproved', params.isApproved.toString());
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    return api.get(`/time-records?${searchParams.toString()}`);
  },

  create: (data: {
    staffId: string;
    clockIn: string;
    clockOut?: string;
    breakMinutes?: number;
    notes?: string;
    shiftId?: string;
  }) => api.post('/time-records', data),

  update: (id: string, data: {
    clockOut?: string;
    breakMinutes?: number;
    notes?: string;
    isApproved?: boolean;
  }) => api.patch(`/time-records/${id}`, data),

  delete: (id: string) => api.delete(`/time-records/${id}`),
}

// Contracts API
export const contractsAPI = {
  getAll: (params?: { staffId?: string; isActive?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.staffId) searchParams.append('staffId', params.staffId);
    if (params?.isActive !== undefined) searchParams.append('isActive', params.isActive.toString());
    return api.get(`/contracts?${searchParams.toString()}`);
  },

  getById: (id: string) => api.get(`/contracts/${id}`),

  create: (data: {
    staffId: string;
    contractType: string;
    startDate: string;
    endDate?: string;
    probationEndDate?: string;
    noticePeriod: number;
    workingHoursPerWeek: number;
    hourlyRate?: number;
    salary?: number;
    currency?: string;
    position?: string;
    department?: string;
    managerId?: string;
    costCenter?: string;
    benefits?: string[];
    qualifications?: string[];
    restrictions?: string[];
  }) => api.post('/contracts', data),

  update: (id: string, data: any) => api.patch(`/contracts/${id}`, data),

  delete: (id: string) => api.delete(`/contracts/${id}`),

  addPreference: (contractId: string, data: {
    dayOfWeek: string;
    shiftType: string;
    preferenceType: string;
    reason?: string;
    notes?: string;
  }) => api.post(`/contracts/${contractId}/preferences`, data),

  deletePreference: (contractId: string, prefId: string) =>
    api.delete(`/contracts/${contractId}/preferences/${prefId}`),
}

// Staff API
export const staffAPI = {
  getAll: (params?: { page?: number; limit?: number; search?: string; staffType?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.search) searchParams.append('search', params.search);
    if (params?.staffType) searchParams.append('staffType', params.staffType);
    return api.get(`/staff?${searchParams.toString()}`);
  },
  
  getById: (id: string) => api.get(`/staff/${id}`),
  
  create: (data: { name: string; gender: 'male' | 'female'; staffType: 'permanent' | 'temporary'; email?: string; qualifications?: string[]; maxHoursPerWeek?: number | null }) =>
    api.post('/staff', data),

  update: (id: string, data: { name?: string; gender?: 'male' | 'female'; staffType?: 'permanent' | 'temporary'; email?: string; qualifications?: string[]; maxHoursPerWeek?: number | null }) =>
    api.put(`/staff/${id}`, data),
  
  delete: (id: string) => api.delete(`/staff/${id}`),
  
  getAvailabilities: (id: string) => api.get(`/staff/${id}/availabilities`),
  
  addAvailability: (id: string, data: { startTime: string; endTime: string }) =>
    api.post(`/staff/${id}/availabilities`, data),
  
  getShifts: (id: string, params?: { startDate?: string; endDate?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    return api.get(`/staff/${id}/shifts?${searchParams.toString()}`);
  },
  
  addShift: (id: string, data: { shiftType: 'day' | 'night'; date: string; startTime: string; endTime: string }) =>
    api.post(`/staff/${id}/shifts`, data),
}

// Availability API
export const availabilityAPI = {
  getAll: (params?: { week?: string; staffType?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.week) searchParams.append('week', params.week);
    if (params?.staffType) searchParams.append('staffType', params.staffType);
    return api.get(`/availability/all?${searchParams.toString()}`);
  },
  
  getByStaff: (staffId: string, week?: string) =>
    api.get(`/availability/staff/${staffId}${week ? `?week=${week}` : ''}`),
  
  addSingle: (staffId: string, data: { startTime: string; endTime: string }) =>
    api.post(`/availability/staff/${staffId}`, data),
  
  addBulk: (staffId: string, data: { availabilities: Array<{ startTime: string; endTime: string }> }) =>
    api.post(`/availability/staff/${staffId}/bulk`, data),
  
  delete: (id: string) => api.delete(`/availability/${id}`),
  
  getStats: (staffId: string, period?: 'week' | 'month' | 'all') =>
    api.get(`/availability/staff/${staffId}/stats${period ? `?period=${period}` : ''}`),
}

// Rules API
export const rulesAPI = {
  getAll: () => api.get('/rules'),

  create: (data: {
    name: string;
    shiftType: 'day' | 'night';
    shiftName?: string;
    startHour?: number;
    endHour?: number;
    dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' | 'everyday';
    requiredStaff: number;
    genderPreference: string;
    requiredQualifications?: string[];
    priority?: number;
  }) => api.post('/rules', data),

  update: (id: string, data: {
    name?: string;
    shiftType?: 'day' | 'night';
    shiftName?: string;
    startHour?: number;
    endHour?: number;
    dayOfWeek?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' | 'everyday';
    requiredStaff?: number;
    genderPreference?: string;
    requiredQualifications?: string[];
    priority?: number;
  }) => api.put(`/rules/${id}`, data),
  
  delete: (id: string) => api.delete(`/rules/${id}`),
  deleteAll: () => api.delete('/rules/all'),
}

// Scheduling API
export const schedulingAPI = {
  generateSchedule: (weekStart: string) => api.post('/scheduling/generate', { weekStart }),

  getWeekSchedule: (weekStart: string) => api.get(`/scheduling/week/${weekStart}`),

  getCurrentWeekSchedule: () => api.get('/scheduling/current-week'),
}

export const schedulePlansAPI = {
  getAll: () => api.get('/schedule-plans'),
  getById: (id: string) => api.get(`/schedule-plans/${id}`),
  create: (data: { name: string; startDate: string; endDate: string }) => api.post('/schedule-plans', data),
  sendEmails: (id: string, staffIds: string[]) => api.post(`/schedule-plans/${id}/send-emails`, { staffIds }),
  delete: (id: string) => api.delete(`/schedule-plans/${id}`),
}

// Scheduling Exceptions API
export const schedulingExceptionsAPI = {
  getAll: (params?: { resolved?: boolean; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.resolved !== undefined) searchParams.append('resolved', params.resolved.toString());
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    return api.get(`/scheduling-exceptions?${searchParams.toString()}`);
  },
  
  getUnresolved: () => api.get('/scheduling-exceptions/unresolved'),
  
  resolve: (id: string) => api.patch(`/scheduling-exceptions/${id}/resolve`),
  
  getById: (id: string) => api.get(`/scheduling-exceptions/${id}`),
  
  create: (data: { shiftId?: string; ruleId: string; message: string }) =>
    api.post('/scheduling-exceptions', data),
}

// Schedule Edits API
export const scheduleEditsAPI = {
  assignStaff: (data: { staffId: string; shiftId: string; date: string; shiftType: 'day' | 'night' }) =>
    api.post('/schedule-edits/assign', data),
  
  removeStaff: (shiftId: string) => api.delete(`/schedule-edits/remove/${shiftId}`),
  
  swapStaff: (data: { shift1Id: string; shift2Id: string }) =>
    api.post('/schedule-edits/swap', data),
  
  getAvailableStaff: (params: { date: string; shiftType: 'day' | 'night' }) => {
    const searchParams = new URLSearchParams();
    searchParams.append('date', params.date);
    searchParams.append('shiftType', params.shiftType);
    return api.get(`/schedule-edits/available-staff?${searchParams.toString()}`);
  },
  
  getShiftDetails: (shiftId: string) => api.get(`/schedule-edits/shift/${shiftId}`),
}

// Reports API
export const reportsAPI = {
  getMonthlyReport: (params?: { month?: number; year?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.month) searchParams.append('month', params.month.toString());
    if (params?.year) searchParams.append('year', params.year.toString());
    return api.get(`/reports/monthly?${searchParams.toString()}`);
  },
  
  getStaffPerformance: (staffId: string, params?: { month?: number; year?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.month) searchParams.append('month', params.month.toString());
    if (params?.year) searchParams.append('year', params.year.toString());
    return api.get(`/reports/staff-performance/${staffId}?${searchParams.toString()}`);
  },
  
  getShiftDistribution: (params?: { month?: number; year?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.month) searchParams.append('month', params.month.toString());
    if (params?.year) searchParams.append('year', params.year.toString());
    return api.get(`/reports/shift-distribution?${searchParams.toString()}`);
  },
}

// Absences API
export const absencesAPI = {
  getAll: (params?: { status?: string; staffId?: string; startDate?: string; endDate?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.staffId) searchParams.append('staffId', params.staffId);
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    return api.get(`/absences?${searchParams.toString()}`);
  },
  
  getPending: () => api.get('/absences/pending'),
  
  getById: (id: string) => api.get(`/absences/${id}`),
  
  create: (data: {
    staffId: string;
    absenceType: 'SICK_LEAVE' | 'PERSONAL_LEAVE' | 'EMERGENCY' | 'OTHER';
    startDate: string;
    endDate: string;
    reason: string;
    notes?: string;
  }) => api.post('/absences', data),
  
  approve: (id: string, data: { status: 'APPROVED' | 'REJECTED'; notes?: string }) =>
    api.patch(`/absences/${id}/approve`, data),
  
  delete: (id: string) => api.delete(`/absences/${id}`),
}

// Vacations API
export const vacationsAPI = {
  getAll: (params?: { status?: string; staffId?: string; vacationType?: string; startDate?: string; endDate?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.staffId) searchParams.append('staffId', params.staffId);
    if (params?.vacationType) searchParams.append('vacationType', params.vacationType);
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    return api.get(`/vacations?${searchParams.toString()}`);
  },
  
  getPending: () => api.get('/vacations/pending'),
  
  getPolicies: () => api.get('/vacations/policies'),
  
  getById: (id: string) => api.get(`/vacations/${id}`),
  
  create: (data: {
    staffId: string;
    vacationType: 'ANNUAL' | 'SICK' | 'PERSONAL' | 'MATERNITY' | 'PATERNITY' | 'BEREAVEMENT' | 'OTHER';
    startDate: string;
    endDate: string;
    reason: string;
    notes?: string;
  }) => api.post('/vacations', data),
  
  approve: (id: string, data: { status: 'APPROVED' | 'REJECTED'; notes?: string }) =>
    api.patch(`/vacations/${id}/approve`, data),
  
  createPolicy: (data: {
    staffType: 'permanent' | 'temporary';
    vacationType: 'ANNUAL' | 'SICK' | 'PERSONAL' | 'MATERNITY' | 'PATERNITY' | 'BEREAVEMENT' | 'OTHER';
    annualAllowance: number;
    carryOverLimit?: number;
    minNoticeDays?: number;
    maxConsecutiveDays?: number;
  }) => api.post('/vacations/policies', data),

  getBalance: (staffId: string) => api.get(`/vacations/balance/${staffId}`),
}

// Shift Swaps API
export const shiftSwapsAPI = {
  getAll: (params?: { status?: string; requesterId?: string; responderId?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.requesterId) searchParams.append('requesterId', params.requesterId);
    if (params?.responderId) searchParams.append('responderId', params.responderId);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    return api.get(`/shift-swaps?${searchParams.toString()}`);
  },
  
  getPending: () => api.get('/shift-swaps/pending'),
  
  getMySwaps: () => api.get('/shift-swaps/my-swaps'),
  
  create: (data: {
    requesterId: string;
    responderId: string;
    requesterShiftId: string;
    responderShiftId: string;
    requesterReason?: string;
  }) => api.post('/shift-swaps', data),
  
  respond: (id: string, data: { status: 'APPROVED' | 'REJECTED'; responderReason?: string }) =>
    api.patch(`/shift-swaps/${id}/respond`, data),
  
  approve: (id: string, data: { status: 'APPROVED' | 'REJECTED' }) =>
    api.patch(`/shift-swaps/${id}/approve`, data),
  
  delete: (id: string) => api.delete(`/shift-swaps/${id}`),
}

// Working Time Accounts API
export const workingTimeAccountsAPI = {
  getAll: (params?: { staffId?: string; accountType?: string; year?: string; month?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.staffId) searchParams.append('staffId', params.staffId);
    if (params?.accountType) searchParams.append('accountType', params.accountType);
    if (params?.year) searchParams.append('year', params.year);
    if (params?.month) searchParams.append('month', params.month);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    return api.get(`/working-time-accounts?${searchParams.toString()}`);
  },
  
  getById: (id: string) => api.get(`/working-time-accounts/${id}`),
  
  getTransactions: (id: string, params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    return api.get(`/working-time-accounts/${id}/transactions?${searchParams.toString()}`);
  },
  
  create: (data: {
    staffId: string;
    accountType: 'OVERTIME' | 'FLEX_TIME' | 'COMP_TIME' | 'VACATION_ACCOUNT' | 'SICK_LEAVE_ACCOUNT';
    year: number;
    month?: number;
    maxBalance?: number;
    minBalance?: number;
  }) => api.post('/working-time-accounts', data),
  
  addTransaction: (accountId: string, data: {
    transactionType: 'CREDIT' | 'DEBIT';
    amount: number;
    description: string;
    referenceType?: string;
    referenceId?: string;
    method?: 'MANUAL' | 'AUTOMATIC' | 'SHYFTPLAN' | 'SAP_INTEGRATION' | 'API_INTEGRATION';
    notes?: string;
  }) => api.post(`/working-time-accounts/${accountId}/transactions`, data),
  
  calculateFromShift: (accountId: string, shiftId: string) =>
    api.post(`/working-time-accounts/${accountId}/calculate-from-shift`, { shiftId }),
  
  getStaffSummary: (staffId: string, params?: { year?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.year) searchParams.append('year', params.year);
    return api.get(`/working-time-accounts/staff/${staffId}/summary?${searchParams.toString()}`);
  },
}

// Spreadsheet Export API
export const spreadsheetExportAPI = {
  exportExcel: (weekStart: string) => api.post('/spreadsheet-export/excel', { weekStart }, {
    responseType: 'blob'
  }),
  
  exportCSV: (weekStart: string) => api.post('/spreadsheet-export/csv', { weekStart }, {
    responseType: 'blob'
  }),
}

export const orgSettingsAPI = {
  get: () => api.get('/org-settings'),
  update: (data: {
    orgName?: string
    timezone?: string
    dayShiftStart?: number
    dayShiftEnd?: number
    nightShiftStart?: number
    nightShiftEnd?: number
    defaultDayStaff?: number
    defaultNightStaff?: number
    syncRulesToDefaults?: boolean
  }) => api.put('/org-settings', data),
}

export default api
