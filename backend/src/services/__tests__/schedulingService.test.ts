import { generateSchedule } from '../schedulingService';
import { startOfWeek, addDays } from 'date-fns';

// Mock the PrismaClient constructor
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    staff: {
      findMany: jest.fn(),
    },
    availability: {
      findMany: jest.fn(),
    },
    rule: {
      findMany: jest.fn(),
    },
    shift: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    schedulingException: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback({
      shift: {
        create: jest.fn(),
      },
      schedulingException: {
        create: jest.fn(),
      },
    })),
  };

  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrismaClient),
  };
});

// Get the mocked instance
const mockPrismaClient = (new (require('@prisma/client').PrismaClient)()) as any;

describe('Scheduling Algorithm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSchedule - Balanced Scenario', () => {
    it('should successfully assign staff when there are enough staff and balanced gender ratio', async () => {
      const weekStart = startOfWeek(new Date('2025-08-18'), { weekStartsOn: 1 });
      
      // Mock staff data
      const mockStaff = [
        {
          id: 'staff1',
          name: 'John Doe',
          gender: 'male',
          staffType: 'permanent',
          qualifications: ['First Aid'],
        },
        {
          id: 'staff2',
          name: 'Jane Smith',
          gender: 'female',
          staffType: 'permanent',
          qualifications: ['First Aid'],
        },
        {
          id: 'staff3',
          name: 'Bob Wilson',
          gender: 'male',
          staffType: 'temporary',
          qualifications: [],
        },
      ];

      // Mock rules
      const mockRules = [
        {
          id: 'rule1',
          name: 'Monday Day Shift',
          shiftType: 'day',
          dayOfWeek: 'monday',
          requiredStaff: 2,
          genderPreference: 'any',
          requiredQualifications: [],
          priority: 1,
        },
      ];

      // Mock availability
      const mockAvailability = [];

      // Mock previous shifts
      const mockPreviousShifts = [];

      // Setup mocks
      mockPrismaClient.staff.findMany.mockResolvedValue(mockStaff);
      mockPrismaClient.rule.findMany.mockResolvedValue(mockRules);
      mockPrismaClient.availability.findMany.mockResolvedValue(mockAvailability);
      mockPrismaClient.shift.findMany.mockResolvedValue(mockPreviousShifts);
      mockPrismaClient.shift.create.mockImplementation((data) => 
        Promise.resolve({
          id: `shift-${Date.now()}`,
          ...data.data,
          staff: mockStaff.find(s => s.id === data.data.staffId),
        })
      );
      mockPrismaClient.schedulingException.create.mockImplementation((data) =>
        Promise.resolve({
          id: `exception-${Date.now()}`,
          ...data.data,
        })
      );

      const result = await generateSchedule(weekStart.toISOString());

      expect(result.shifts).toHaveLength(2);
      expect(result.exceptions).toHaveLength(0);
      expect(result.summary.totalShifts).toBe(2);
      expect(result.summary.totalExceptions).toBe(0);
    });
  });

  describe('generateSchedule - Insufficient Staff', () => {
    it('should create exceptions when there are not enough staff for a shift', async () => {
      const weekStart = startOfWeek(new Date('2025-08-18'), { weekStartsOn: 1 });
      
      // Mock limited staff
      const mockStaff = [
        {
          id: 'staff1',
          name: 'John Doe',
          gender: 'male',
          staffType: 'permanent',
          qualifications: [],
        },
      ];

      // Mock rule requiring more staff than available
      const mockRules = [
        {
          id: 'rule1',
          name: 'Monday Day Shift',
          shiftType: 'day',
          dayOfWeek: 'monday',
          requiredStaff: 3,
          genderPreference: 'any',
          requiredQualifications: [],
          priority: 1,
        },
      ];

      const mockAvailability = [];
      const mockPreviousShifts = [];

      mockPrismaClient.staff.findMany.mockResolvedValue(mockStaff);
      mockPrismaClient.rule.findMany.mockResolvedValue(mockRules);
      mockPrismaClient.availability.findMany.mockResolvedValue(mockAvailability);
      mockPrismaClient.shift.findMany.mockResolvedValue(mockPreviousShifts);
      mockPrismaClient.shift.create.mockImplementation((data) => 
        Promise.resolve({
          id: `shift-${Date.now()}`,
          ...data.data,
          staff: mockStaff.find(s => s.id === data.data.staffId),
        })
      );
      mockPrismaClient.schedulingException.create.mockImplementation((data) =>
        Promise.resolve({
          id: `exception-${Date.now()}`,
          ...data.data,
        })
      );

      const result = await generateSchedule(weekStart.toISOString());

      expect(result.shifts).toHaveLength(1);
      expect(result.exceptions).toHaveLength(1);
      expect(result.exceptions[0].message).toContain('Only 1 out of 3 required staff assigned');
      expect(result.exceptions[0].severity).toBe('warning');
    });
  });

  describe('generateSchedule - Gender Preference Not Met', () => {
    it('should create exceptions when gender preference cannot be met', async () => {
      const weekStart = startOfWeek(new Date('2025-08-18'), { weekStartsOn: 1 });
      
      // Mock only male staff
      const mockStaff = [
        {
          id: 'staff1',
          name: 'John Doe',
          gender: 'male',
          staffType: 'permanent',
          qualifications: [],
        },
        {
          id: 'staff2',
          name: 'Bob Wilson',
          gender: 'male',
          staffType: 'permanent',
          qualifications: [],
        },
      ];

      // Mock rule requiring female staff
      const mockRules = [
        {
          id: 'rule1',
          name: 'Monday Day Shift - Female Only',
          shiftType: 'day',
          dayOfWeek: 'monday',
          requiredStaff: 1,
          genderPreference: 'female',
          requiredQualifications: [],
          priority: 1,
        },
      ];

      const mockAvailability = [];
      const mockPreviousShifts = [];

      mockPrismaClient.staff.findMany.mockResolvedValue(mockStaff);
      mockPrismaClient.rule.findMany.mockResolvedValue(mockRules);
      mockPrismaClient.availability.findMany.mockResolvedValue(mockAvailability);
      mockPrismaClient.shift.findMany.mockResolvedValue(mockPreviousShifts);
      mockPrismaClient.shift.create.mockImplementation((data) => 
        Promise.resolve({
          id: `shift-${Date.now()}`,
          ...data.data,
          staff: mockStaff.find(s => s.id === data.data.staffId),
        })
      );
      mockPrismaClient.schedulingException.create.mockImplementation((data) =>
        Promise.resolve({
          id: `exception-${Date.now()}`,
          ...data.data,
        })
      );

      const result = await generateSchedule(weekStart.toISOString());

      expect(result.shifts).toHaveLength(0);
      expect(result.exceptions).toHaveLength(1);
      expect(result.exceptions[0].message).toContain('Only 0 out of 1 required staff assigned');
      expect(result.exceptions[0].severity).toBe('error');
    });
  });

  describe('generateSchedule - Required Qualifications Not Met', () => {
    it('should create exceptions when required qualifications cannot be met', async () => {
      const weekStart = startOfWeek(new Date('2025-08-18'), { weekStartsOn: 1 });
      
      // Mock staff without required qualifications
      const mockStaff = [
        {
          id: 'staff1',
          name: 'John Doe',
          gender: 'male',
          staffType: 'permanent',
          qualifications: ['Basic Care'],
        },
        {
          id: 'staff2',
          name: 'Jane Smith',
          gender: 'female',
          staffType: 'permanent',
          qualifications: ['Basic Care'],
        },
      ];

      // Mock rule requiring specific qualifications
      const mockRules = [
        {
          id: 'rule1',
          name: 'Specialized Care Shift',
          shiftType: 'day',
          dayOfWeek: 'monday',
          requiredStaff: 1,
          genderPreference: 'any',
          requiredQualifications: ['Dementia Care', 'First Aid'],
          priority: 1,
        },
      ];

      const mockAvailability = [];
      const mockPreviousShifts = [];

      mockPrismaClient.staff.findMany.mockResolvedValue(mockStaff);
      mockPrismaClient.rule.findMany.mockResolvedValue(mockRules);
      mockPrismaClient.availability.findMany.mockResolvedValue(mockAvailability);
      mockPrismaClient.shift.findMany.mockResolvedValue(mockPreviousShifts);
      mockPrismaClient.shift.create.mockImplementation((data) => 
        Promise.resolve({
          id: `shift-${Date.now()}`,
          ...data.data,
          staff: mockStaff.find(s => s.id === data.data.staffId),
        })
      );
      mockPrismaClient.schedulingException.create.mockImplementation((data) =>
        Promise.resolve({
          id: `exception-${Date.now()}`,
          ...data.data,
        })
      );

      const result = await generateSchedule(weekStart.toISOString());

      expect(result.shifts).toHaveLength(0);
      expect(result.exceptions).toHaveLength(1);
      expect(result.exceptions[0].message).toContain('Required qualifications: Dementia Care, First Aid');
      expect(result.exceptions[0].severity).toBe('error');
    });
  });

  describe('generateSchedule - Fairness Rules', () => {
    it('should prioritize staff with fewer previous shifts', async () => {
      const weekStart = startOfWeek(new Date('2025-08-18'), { weekStartsOn: 1 });
      
      const mockStaff = [
        {
          id: 'staff1',
          name: 'John Doe',
          gender: 'male',
          staffType: 'permanent',
          qualifications: [],
        },
        {
          id: 'staff2',
          name: 'Jane Smith',
          gender: 'female',
          staffType: 'permanent',
          qualifications: [],
        },
      ];

      const mockRules = [
        {
          id: 'rule1',
          name: 'Monday Day Shift',
          shiftType: 'day',
          dayOfWeek: 'monday',
          requiredStaff: 1,
          genderPreference: 'any',
          requiredQualifications: [],
          priority: 1,
        },
      ];

      const mockAvailability = [];
      
      // Mock previous shifts - John has more shifts than Jane
      const mockPreviousShifts = [
        {
          id: 'prev1',
          staffId: 'staff1',
          date: addDays(weekStart, -1),
          shiftType: 'day',
          staff: mockStaff[0],
        },
        {
          id: 'prev2',
          staffId: 'staff1',
          date: addDays(weekStart, -2),
          shiftType: 'day',
          staff: mockStaff[0],
        },
      ];

      mockPrismaClient.staff.findMany.mockResolvedValue(mockStaff);
      mockPrismaClient.rule.findMany.mockResolvedValue(mockRules);
      mockPrismaClient.availability.findMany.mockResolvedValue(mockAvailability);
      mockPrismaClient.shift.findMany.mockResolvedValue(mockPreviousShifts);
      mockPrismaClient.shift.create.mockImplementation((data) => 
        Promise.resolve({
          id: `shift-${Date.now()}`,
          ...data.data,
          staff: mockStaff.find(s => s.id === data.data.staffId),
        })
      );
      mockPrismaClient.schedulingException.create.mockImplementation((data) =>
        Promise.resolve({
          id: `exception-${Date.now()}`,
          ...data.data,
        })
      );

      const result = await generateSchedule(weekStart.toISOString());

      expect(result.shifts).toHaveLength(1);
      // Jane should be assigned because she has fewer previous shifts
      expect(result.shifts[0].staffId).toBe('staff2');
    });
  });

  describe('generateSchedule - Conflict Detection', () => {
    it('should not assign staff to conflicting shifts on the same day', async () => {
      const weekStart = startOfWeek(new Date('2025-08-18'), { weekStartsOn: 1 });
      
      const mockStaff = [
        {
          id: 'staff1',
          name: 'John Doe',
          gender: 'male',
          staffType: 'permanent',
          qualifications: [],
        },
        {
          id: 'staff2',
          name: 'Jane Smith',
          gender: 'female',
          staffType: 'permanent',
          qualifications: [],
        },
      ];

      const mockRules = [
        {
          id: 'rule1',
          name: 'Monday Day Shift',
          shiftType: 'day',
          dayOfWeek: 'monday',
          requiredStaff: 1,
          genderPreference: 'any',
          requiredQualifications: [],
          priority: 1,
        },
        {
          id: 'rule2',
          name: 'Monday Night Shift',
          shiftType: 'night',
          dayOfWeek: 'monday',
          requiredStaff: 1,
          genderPreference: 'any',
          requiredQualifications: [],
          priority: 1,
        },
      ];

      const mockAvailability = [];
      const mockPreviousShifts = [];

      mockPrismaClient.staff.findMany.mockResolvedValue(mockStaff);
      mockPrismaClient.rule.findMany.mockResolvedValue(mockRules);
      mockPrismaClient.availability.findMany.mockResolvedValue(mockAvailability);
      mockPrismaClient.shift.findMany.mockResolvedValue(mockPreviousShifts);
      mockPrismaClient.shift.create.mockImplementation((data) => 
        Promise.resolve({
          id: `shift-${Date.now()}`,
          ...data.data,
          staff: mockStaff.find(s => s.id === data.data.staffId),
        })
      );
      mockPrismaClient.schedulingException.create.mockImplementation((data) =>
        Promise.resolve({
          id: `exception-${Date.now()}`,
          ...data.data,
        })
      );

      const result = await generateSchedule(weekStart.toISOString());

      expect(result.shifts).toHaveLength(2);
      
      // Check that different staff are assigned to day and night shifts
      const dayShift = result.shifts.find(s => s.shiftType === 'day');
      const nightShift = result.shifts.find(s => s.shiftType === 'night');
      
      expect(dayShift?.staffId).not.toBe(nightShift?.staffId);
    });
  });
});
