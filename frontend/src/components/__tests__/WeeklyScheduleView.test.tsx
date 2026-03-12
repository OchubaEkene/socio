import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import WeeklyScheduleView from '../WeeklyScheduleView';
import { schedulingAPI, scheduleEditsAPI } from '../../lib/api';

// Mock the API
jest.mock('../../lib/api', () => ({
  schedulingAPI: {
    getWeeklyShifts: jest.fn(),
  },
  scheduleEditsAPI: {
    getAvailableStaff: jest.fn(),
    assignStaff: jest.fn(),
    removeStaff: jest.fn(),
    swapStaff: jest.fn(),
    getShift: jest.fn(),
  },
}));

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

const mockSchedulingAPI = schedulingAPI as jest.Mocked<typeof schedulingAPI>;
const mockScheduleEditsAPI = scheduleEditsAPI as jest.Mocked<typeof scheduleEditsAPI>;

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('WeeklyScheduleView - Manual Edit Modal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock weekly shifts data
    mockSchedulingAPI.getWeeklyShifts.mockResolvedValue({
      data: {
        shifts: [
          {
            id: 'shift1',
            staffId: 'staff1',
            staff: {
              id: 'staff1',
              name: 'John Doe',
              gender: 'male',
              staffType: 'permanent',
            },
            date: '2025-08-18',
            shiftType: 'day',
            startTime: '08:00',
            endTime: '16:00',
          },
          {
            id: 'shift2',
            staffId: 'staff2',
            staff: {
              id: 'staff2',
              name: 'Jane Smith',
              gender: 'female',
              staffType: 'permanent',
            },
            date: '2025-08-18',
            shiftType: 'night',
            startTime: '20:00',
            endTime: '08:00',
          },
        ],
      },
    });

    // Mock available staff
    mockScheduleEditsAPI.getAvailableStaff.mockResolvedValue({
      data: {
        staff: [
          {
            id: 'staff1',
            name: 'John Doe',
            gender: 'male',
            staffType: 'permanent',
          },
          {
            id: 'staff2',
            name: 'Jane Smith',
            gender: 'female',
            staffType: 'permanent',
          },
          {
            id: 'staff3',
            name: 'Bob Wilson',
            gender: 'male',
            staffType: 'temporary',
          },
        ],
      },
    });
  });

  describe('Manual Edit Modal - Assign Staff', () => {
    it('should open edit modal when a cell is double-clicked', async () => {
      renderWithProviders(<WeeklyScheduleView />);

      await waitFor(() => {
        expect(screen.getByText('Weekly Schedule')).toBeInTheDocument();
      });

      // Find and double-click a cell
      const cell = screen.getByText('John Doe');
      fireEvent.doubleClick(cell);

      // Check if modal is opened
      expect(screen.getByText('Edit Shift Assignment')).toBeInTheDocument();
      expect(screen.getByText('Monday, Aug 18 - Day Shift')).toBeInTheDocument();
    });

    it('should allow assigning a staff member to an empty shift', async () => {
      const user = userEvent.setup();
      mockScheduleEditsAPI.assignStaff.mockResolvedValue({
        data: {
          shift: {
            id: 'new-shift',
            staffId: 'staff3',
            staff: {
              id: 'staff3',
              name: 'Bob Wilson',
              gender: 'male',
              staffType: 'temporary',
            },
            date: '2025-08-19',
            shiftType: 'day',
            startTime: '08:00',
            endTime: '16:00',
          },
        },
      });

      renderWithProviders(<WeeklyScheduleView />);

      await waitFor(() => {
        expect(screen.getByText('Weekly Schedule')).toBeInTheDocument();
      });

      // Find and double-click an empty cell (Tuesday)
      const tuesdayHeader = screen.getByText('Tuesday');
      const tuesdayRow = tuesdayHeader.closest('tr');
      const emptyCell = tuesdayRow?.querySelector('td:last-child');
      if (emptyCell) {
        fireEvent.doubleClick(emptyCell);
      }

      // Check if modal is opened for new assignment
      expect(screen.getByText('Edit Shift Assignment')).toBeInTheDocument();
      expect(screen.getByText('Tuesday, Aug 19 - Day Shift')).toBeInTheDocument();

      // Select a staff member
      const staffSelect = screen.getByLabelText(/Assign Staff/i);
      fireEvent.change(staffSelect, { target: { value: 'staff3' } });

      // Submit the assignment
      const assignButton = screen.getByText('Assign Staff');
      fireEvent.click(assignButton);

      // Verify API call
      await waitFor(() => {
        expect(mockScheduleEditsAPI.assignStaff).toHaveBeenCalledWith({
          staffId: 'staff3',
          date: '2025-08-19',
          shiftType: 'day',
          startTime: '08:00',
          endTime: '16:00',
        });
      });
    });

    it('should handle assignment errors gracefully', async () => {
      const user = userEvent.setup();
      mockScheduleEditsAPI.assignStaff.mockRejectedValue(new Error('Assignment failed'));

      renderWithProviders(<WeeklyScheduleView />);

      await waitFor(() => {
        expect(screen.getByText('Weekly Schedule')).toBeInTheDocument();
      });

      // Double-click an empty cell
      const tuesdayHeader = screen.getByText('Tuesday');
      const tuesdayRow = tuesdayHeader.closest('tr');
      const emptyCell = tuesdayRow?.querySelector('td:last-child');
      if (emptyCell) {
        fireEvent.doubleClick(emptyCell);
      }

      // Select a staff member
      const staffSelect = screen.getByLabelText(/Assign Staff/i);
      fireEvent.change(staffSelect, { target: { value: 'staff3' } });

      // Submit the assignment
      const assignButton = screen.getByText('Assign Staff');
      fireEvent.click(assignButton);

      // Verify error handling
      await waitFor(() => {
        expect(mockScheduleEditsAPI.assignStaff).toHaveBeenCalled();
      });
    });
  });

  describe('Manual Edit Modal - Remove Staff', () => {
    it('should allow removing a staff member from a shift', async () => {
      const user = userEvent.setup();
      mockScheduleEditsAPI.removeStaff.mockResolvedValue({
        data: { message: 'Staff removed successfully' },
      });

      renderWithProviders(<WeeklyScheduleView />);

      await waitFor(() => {
        expect(screen.getByText('Weekly Schedule')).toBeInTheDocument();
      });

      // Double-click a cell with assigned staff
      const cell = screen.getByText('John Doe');
      fireEvent.doubleClick(cell);

      // Check if modal shows current assignment
      expect(screen.getByText('Edit Shift Assignment')).toBeInTheDocument();
      expect(screen.getByText('Currently assigned: John Doe')).toBeInTheDocument();

      // Click remove button
      const removeButton = screen.getByText('Remove Staff');
      fireEvent.click(removeButton);

      // Verify API call
      await waitFor(() => {
        expect(mockScheduleEditsAPI.removeStaff).toHaveBeenCalledWith('shift1');
      });
    });

    it('should handle removal errors gracefully', async () => {
      const user = userEvent.setup();
      mockScheduleEditsAPI.removeStaff.mockRejectedValue(new Error('Removal failed'));

      renderWithProviders(<WeeklyScheduleView />);

      await waitFor(() => {
        expect(screen.getByText('Weekly Schedule')).toBeInTheDocument();
      });

      // Double-click a cell with assigned staff
      const cell = screen.getByText('John Doe');
      fireEvent.doubleClick(cell);

      // Click remove button
      const removeButton = screen.getByText('Remove Staff');
      fireEvent.click(removeButton);

      // Verify error handling
      await waitFor(() => {
        expect(mockScheduleEditsAPI.removeStaff).toHaveBeenCalled();
      });
    });
  });

  describe('Manual Edit Modal - Swap Staff', () => {
    it('should allow swapping two staff members between shifts', async () => {
      const user = userEvent.setup();
      mockScheduleEditsAPI.swapStaff.mockResolvedValue({
        data: {
          shifts: [
            {
              id: 'shift1',
              staffId: 'staff2',
              staff: {
                id: 'staff2',
                name: 'Jane Smith',
                gender: 'female',
                staffType: 'permanent',
              },
              date: '2025-08-18',
              shiftType: 'day',
              startTime: '08:00',
              endTime: '16:00',
            },
            {
              id: 'shift2',
              staffId: 'staff1',
              staff: {
                id: 'staff1',
                name: 'John Doe',
                gender: 'male',
                staffType: 'permanent',
              },
              date: '2025-08-18',
              shiftType: 'night',
              startTime: '20:00',
              endTime: '08:00',
            },
          ],
        },
      });

      renderWithProviders(<WeeklyScheduleView />);

      await waitFor(() => {
        expect(screen.getByText('Weekly Schedule')).toBeInTheDocument();
      });

      // Double-click a cell with assigned staff
      const cell = screen.getByText('John Doe');
      fireEvent.doubleClick(cell);

      // Switch to swap mode
      const swapTab = screen.getByText('Swap Staff');
      fireEvent.click(swapTab);

      // Select target shift
      const targetShiftSelect = screen.getByLabelText(/Target Shift/i);
      fireEvent.change(targetShiftSelect, { target: { value: 'shift2' } });

      // Submit the swap
      const swapButton = screen.getByText('Swap Staff');
      fireEvent.click(swapButton);

      // Verify API call
      await waitFor(() => {
        expect(mockScheduleEditsAPI.swapStaff).toHaveBeenCalledWith({
          shift1Id: 'shift1',
          shift2Id: 'shift2',
        });
      });
    });

    it('should validate swap selection before submission', async () => {
      const user = userEvent.setup();
      renderWithProviders(<WeeklyScheduleView />);

      await waitFor(() => {
        expect(screen.getByText('Weekly Schedule')).toBeInTheDocument();
      });

      // Double-click a cell with assigned staff
      const cell = screen.getByText('John Doe');
      fireEvent.doubleClick(cell);

      // Switch to swap mode
      const swapTab = screen.getByText('Swap Staff');
      fireEvent.click(swapTab);

      // Try to submit without selecting target shift
      const swapButton = screen.getByText('Swap Staff');
      fireEvent.click(swapButton);

      // Verify that API is not called due to validation
      await waitFor(() => {
        expect(mockScheduleEditsAPI.swapStaff).not.toHaveBeenCalled();
      });
    });

    it('should handle swap errors gracefully', async () => {
      const user = userEvent.setup();
      mockScheduleEditsAPI.swapStaff.mockRejectedValue(new Error('Swap failed'));

      renderWithProviders(<WeeklyScheduleView />);

      await waitFor(() => {
        expect(screen.getByText('Weekly Schedule')).toBeInTheDocument();
      });

      // Double-click a cell with assigned staff
      const cell = screen.getByText('John Doe');
      fireEvent.doubleClick(cell);

      // Switch to swap mode
      const swapTab = screen.getByText('Swap Staff');
      fireEvent.click(swapTab);

      // Select target shift
      const targetShiftSelect = screen.getByLabelText(/Target Shift/i);
      fireEvent.change(targetShiftSelect, { target: { value: 'shift2' } });

      // Submit the swap
      const swapButton = screen.getByText('Swap Staff');
      fireEvent.click(swapButton);

      // Verify error handling
      await waitFor(() => {
        expect(mockScheduleEditsAPI.swapStaff).toHaveBeenCalled();
      });
    });
  });

  describe('Modal Navigation and State Management', () => {
    it('should close modal when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<WeeklyScheduleView />);

      await waitFor(() => {
        expect(screen.getByText('Weekly Schedule')).toBeInTheDocument();
      });

      // Double-click a cell to open modal
      const cell = screen.getByText('John Doe');
      fireEvent.doubleClick(cell);

      // Verify modal is open
      expect(screen.getByText('Edit Shift Assignment')).toBeInTheDocument();

      // Click cancel button
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      // Verify modal is closed
      await waitFor(() => {
        expect(screen.queryByText('Edit Shift Assignment')).not.toBeInTheDocument();
      });
    });

    it('should switch between assign and swap tabs correctly', async () => {
      const user = userEvent.setup();
      renderWithProviders(<WeeklyScheduleView />);

      await waitFor(() => {
        expect(screen.getByText('Weekly Schedule')).toBeInTheDocument();
      });

      // Double-click a cell to open modal
      const cell = screen.getByText('John Doe');
      fireEvent.doubleClick(cell);

      // Verify assign tab is active by default
      expect(screen.getByText('Assign Staff')).toBeInTheDocument();
      expect(screen.queryByText('Target Shift')).not.toBeInTheDocument();

      // Switch to swap tab
      const swapTab = screen.getByText('Swap Staff');
      fireEvent.click(swapTab);

      // Verify swap tab is active
      expect(screen.getByText('Target Shift')).toBeInTheDocument();
      expect(screen.queryByText('Assign Staff')).not.toBeInTheDocument();

      // Switch back to assign tab
      const assignTab = screen.getByText('Assign Staff');
      fireEvent.click(assignTab);

      // Verify assign tab is active again
      expect(screen.getByText('Assign Staff')).toBeInTheDocument();
      expect(screen.queryByText('Target Shift')).not.toBeInTheDocument();
    });

    it('should load available staff when modal opens', async () => {
      renderWithProviders(<WeeklyScheduleView />);

      await waitFor(() => {
        expect(screen.getByText('Weekly Schedule')).toBeInTheDocument();
      });

      // Double-click a cell to open modal
      const cell = screen.getByText('John Doe');
      fireEvent.doubleClick(cell);

      // Verify available staff API was called
      await waitFor(() => {
        expect(mockScheduleEditsAPI.getAvailableStaff).toHaveBeenCalledWith({
          date: '2025-08-18',
          shiftType: 'day',
        });
      });
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields in assign mode', async () => {
      const user = userEvent.setup();
      renderWithProviders(<WeeklyScheduleView />);

      await waitFor(() => {
        expect(screen.getByText('Weekly Schedule')).toBeInTheDocument();
      });

      // Double-click an empty cell
      const tuesdayHeader = screen.getByText('Tuesday');
      const tuesdayRow = tuesdayHeader.closest('tr');
      const emptyCell = tuesdayRow?.querySelector('td:last-child');
      if (emptyCell) {
        fireEvent.doubleClick(emptyCell);
      }

      // Try to submit without selecting staff
      const assignButton = screen.getByText('Assign Staff');
      fireEvent.click(assignButton);

      // Verify that API is not called due to validation
      await waitFor(() => {
        expect(mockScheduleEditsAPI.assignStaff).not.toHaveBeenCalled();
      });
    });

    it('should validate required fields in swap mode', async () => {
      const user = userEvent.setup();
      renderWithProviders(<WeeklyScheduleView />);

      await waitFor(() => {
        expect(screen.getByText('Weekly Schedule')).toBeInTheDocument();
      });

      // Double-click a cell with assigned staff
      const cell = screen.getByText('John Doe');
      fireEvent.doubleClick(cell);

      // Switch to swap mode
      const swapTab = screen.getByText('Swap Staff');
      fireEvent.click(swapTab);

      // Try to submit without selecting target shift
      const swapButton = screen.getByText('Swap Staff');
      fireEvent.click(swapButton);

      // Verify that API is not called due to validation
      await waitFor(() => {
        expect(mockScheduleEditsAPI.swapStaff).not.toHaveBeenCalled();
      });
    });
  });
});
