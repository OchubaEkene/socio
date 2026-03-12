import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import Rules from '../Rules';
import { rulesAPI } from '../../lib/api';

// Mock the API
jest.mock('../../lib/api', () => ({
  rulesAPI: {
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

const mockRulesAPI = rulesAPI as jest.Mocked<typeof rulesAPI>;

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

describe('Rules Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful API responses
    mockRulesAPI.getAll.mockResolvedValue({
      data: {
        rules: [
          {
            id: 'rule1',
            name: 'Monday Day Shift',
            shiftType: 'day',
            dayOfWeek: 'monday',
            requiredStaff: 2,
            genderPreference: 'any',
            requiredQualifications: ['First Aid'],
            priority: 1,
            createdAt: '2025-08-13T10:00:00Z',
            updatedAt: '2025-08-13T10:00:00Z',
          },
        ],
      },
    });
  });

  describe('Rule Creation Form', () => {
    it('should render the create rule form when "Create New Rule" button is clicked', async () => {
      renderWithProviders(<Rules />);

      // Wait for the component to load
      await waitFor(() => {
        expect(screen.getByText('Staffing Rules')).toBeInTheDocument();
      });

      // Click create button
      const createButton = screen.getByText('Create New Rule');
      fireEvent.click(createButton);

      // Check if form is rendered
      expect(screen.getByText('Create New Rule')).toBeInTheDocument();
      expect(screen.getByLabelText(/Rule Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Shift Type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Day of Week/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Required Staff/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Gender Preference/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Required Qualifications/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Priority/i)).toBeInTheDocument();
    });

    it('should validate required fields when submitting empty form', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Rules />);

      await waitFor(() => {
        expect(screen.getByText('Staffing Rules')).toBeInTheDocument();
      });

      // Open create form
      const createButton = screen.getByText('Create New Rule');
      fireEvent.click(createButton);

      // Try to submit without filling required fields
      const submitButton = screen.getByText('Create');
      fireEvent.click(submitButton);

      // Check that form validation prevents submission
      await waitFor(() => {
        expect(mockRulesAPI.create).not.toHaveBeenCalled();
      });
    });

    it('should successfully create a rule with valid data', async () => {
      const user = userEvent.setup();
      mockRulesAPI.create.mockResolvedValue({
        data: {
          rule: {
            id: 'new-rule',
            name: 'Test Rule',
            shiftType: 'day',
            dayOfWeek: 'monday',
            requiredStaff: 2,
            genderPreference: 'any',
            requiredQualifications: ['First Aid'],
            priority: 1,
            createdAt: '2025-08-13T10:00:00Z',
            updatedAt: '2025-08-13T10:00:00Z',
          },
        },
      });

      renderWithProviders(<Rules />);

      await waitFor(() => {
        expect(screen.getByText('Staffing Rules')).toBeInTheDocument();
      });

      // Open create form
      const createButton = screen.getByText('Create New Rule');
      fireEvent.click(createButton);

      // Fill in the form
      await user.type(screen.getByLabelText(/Rule Name/i), 'Test Rule');
      fireEvent.change(screen.getByLabelText(/Shift Type/i), { target: { value: 'day' } });
      fireEvent.change(screen.getByLabelText(/Day of Week/i), { target: { value: 'monday' } });
      await user.type(screen.getByLabelText(/Required Staff/i), '2');
      fireEvent.change(screen.getByLabelText(/Gender Preference/i), { target: { value: 'any' } });
      await user.type(screen.getByLabelText(/Required Qualifications/i), 'First Aid, Dementia Care');
      await user.type(screen.getByLabelText(/Priority/i), '1');

      // Submit the form
      const submitButton = screen.getByText('Create');
      fireEvent.click(submitButton);

      // Verify API call
      await waitFor(() => {
        expect(mockRulesAPI.create).toHaveBeenCalledWith({
          name: 'Test Rule',
          shiftType: 'day',
          dayOfWeek: 'monday',
          requiredStaff: 2,
          genderPreference: 'any',
          requiredQualifications: ['First Aid', 'Dementia Care'],
          priority: 1,
        });
      });
    });

    it('should handle API errors when creating a rule', async () => {
      const user = userEvent.setup();
      mockRulesAPI.create.mockRejectedValue(new Error('API Error'));

      renderWithProviders(<Rules />);

      await waitFor(() => {
        expect(screen.getByText('Staffing Rules')).toBeInTheDocument();
      });

      // Open create form
      const createButton = screen.getByText('Create New Rule');
      fireEvent.click(createButton);

      // Fill in the form
      await user.type(screen.getByLabelText(/Rule Name/i), 'Test Rule');
      fireEvent.change(screen.getByLabelText(/Shift Type/i), { target: { value: 'day' } });
      fireEvent.change(screen.getByLabelText(/Day of Week/i), { target: { value: 'monday' } });
      await user.type(screen.getByLabelText(/Required Staff/i), '2');
      fireEvent.change(screen.getByLabelText(/Gender Preference/i), { target: { value: 'any' } });

      // Submit the form
      const submitButton = screen.getByText('Create');
      fireEvent.click(submitButton);

      // Verify error handling
      await waitFor(() => {
        expect(mockRulesAPI.create).toHaveBeenCalled();
      });
    });

    it('should validate numeric fields correctly', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Rules />);

      await waitFor(() => {
        expect(screen.getByText('Staffing Rules')).toBeInTheDocument();
      });

      // Open create form
      const createButton = screen.getByText('Create New Rule');
      fireEvent.click(createButton);

      // Try to enter invalid data
      await user.type(screen.getByLabelText(/Required Staff/i), '0'); // Invalid: must be > 0
      await user.type(screen.getByLabelText(/Priority/i), '101'); // Invalid: must be <= 100

      // Fill other required fields
      await user.type(screen.getByLabelText(/Rule Name/i), 'Test Rule');
      fireEvent.change(screen.getByLabelText(/Shift Type/i), { target: { value: 'day' } });
      fireEvent.change(screen.getByLabelText(/Day of Week/i), { target: { value: 'monday' } });
      fireEvent.change(screen.getByLabelText(/Gender Preference/i), { target: { value: 'any' } });

      // Submit the form
      const submitButton = screen.getByText('Create');
      fireEvent.click(submitButton);

      // Verify that API is not called due to validation
      await waitFor(() => {
        expect(mockRulesAPI.create).not.toHaveBeenCalled();
      });
    });
  });

  describe('Rule Editing', () => {
    it('should open edit form when edit button is clicked', async () => {
      renderWithProviders(<Rules />);

      await waitFor(() => {
        expect(screen.getByText('Monday Day Shift')).toBeInTheDocument();
      });

      // Click edit button
      const editButton = screen.getByTitle('Edit');
      fireEvent.click(editButton);

      // Check if edit form is rendered with pre-filled data
      expect(screen.getByText('Edit Rule')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Monday Day Shift')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    });

    it('should successfully update a rule', async () => {
      const user = userEvent.setup();
      mockRulesAPI.update.mockResolvedValue({
        data: {
          rule: {
            id: 'rule1',
            name: 'Updated Rule',
            shiftType: 'night',
            dayOfWeek: 'tuesday',
            requiredStaff: 3,
            genderPreference: 'female',
            requiredQualifications: ['First Aid'],
            priority: 2,
            createdAt: '2025-08-13T10:00:00Z',
            updatedAt: '2025-08-13T10:00:00Z',
          },
        },
      });

      renderWithProviders(<Rules />);

      await waitFor(() => {
        expect(screen.getByText('Monday Day Shift')).toBeInTheDocument();
      });

      // Open edit form
      const editButton = screen.getByTitle('Edit');
      fireEvent.click(editButton);

      // Update the form
      const nameInput = screen.getByDisplayValue('Monday Day Shift');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Rule');

      const staffInput = screen.getByDisplayValue('2');
      await user.clear(staffInput);
      await user.type(staffInput, '3');

      // Submit the form
      const submitButton = screen.getByText('Update');
      fireEvent.click(submitButton);

      // Verify API call
      await waitFor(() => {
        expect(mockRulesAPI.update).toHaveBeenCalledWith('rule1', {
          name: 'Updated Rule',
          requiredStaff: 3,
        });
      });
    });
  });

  describe('Rule Deletion', () => {
    it('should show confirmation dialog when delete button is clicked', async () => {
      const user = userEvent.setup();
      // Mock window.confirm
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      mockRulesAPI.delete.mockResolvedValue({});

      renderWithProviders(<Rules />);

      await waitFor(() => {
        expect(screen.getByText('Monday Day Shift')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButton = screen.getByTitle('Delete');
      fireEvent.click(deleteButton);

      // Verify confirmation dialog
      expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this rule?');

      // Verify API call after confirmation
      await waitFor(() => {
        expect(mockRulesAPI.delete).toHaveBeenCalledWith('rule1');
      });

      confirmSpy.mockRestore();
    });

    it('should not delete rule when user cancels confirmation', async () => {
      const user = userEvent.setup();
      // Mock window.confirm to return false (cancel)
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

      renderWithProviders(<Rules />);

      await waitFor(() => {
        expect(screen.getByText('Monday Day Shift')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButton = screen.getByTitle('Delete');
      fireEvent.click(deleteButton);

      // Verify confirmation dialog was shown
      expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this rule?');

      // Verify API was not called
      expect(mockRulesAPI.delete).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });
  });

  describe('Form Validation', () => {
    it('should validate rule name length', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Rules />);

      await waitFor(() => {
        expect(screen.getByText('Staffing Rules')).toBeInTheDocument();
      });

      // Open create form
      const createButton = screen.getByText('Create New Rule');
      fireEvent.click(createButton);

      // Try to submit with very long name
      const nameInput = screen.getByLabelText(/Rule Name/i);
      await user.type(nameInput, 'A'.repeat(101)); // Exceeds max length

      // Fill other required fields
      fireEvent.change(screen.getByLabelText(/Shift Type/i), { target: { value: 'day' } });
      fireEvent.change(screen.getByLabelText(/Day of Week/i), { target: { value: 'monday' } });
      await user.type(screen.getByLabelText(/Required Staff/i), '2');
      fireEvent.change(screen.getByLabelText(/Gender Preference/i), { target: { value: 'any' } });

      // Submit the form
      const submitButton = screen.getByText('Create');
      fireEvent.click(submitButton);

      // Verify that API is not called due to validation
      await waitFor(() => {
        expect(mockRulesAPI.create).not.toHaveBeenCalled();
      });
    });

    it('should handle qualifications input correctly', async () => {
      const user = userEvent.setup();
      mockRulesAPI.create.mockResolvedValue({
        data: {
          rule: {
            id: 'new-rule',
            name: 'Test Rule',
            shiftType: 'day',
            dayOfWeek: 'monday',
            requiredStaff: 2,
            genderPreference: 'any',
            requiredQualifications: ['First Aid', 'Dementia Care'],
            priority: 1,
            createdAt: '2025-08-13T10:00:00Z',
            updatedAt: '2025-08-13T10:00:00Z',
          },
        },
      });

      renderWithProviders(<Rules />);

      await waitFor(() => {
        expect(screen.getByText('Staffing Rules')).toBeInTheDocument();
      });

      // Open create form
      const createButton = screen.getByText('Create New Rule');
      fireEvent.click(createButton);

      // Fill in the form with qualifications
      await user.type(screen.getByLabelText(/Rule Name/i), 'Test Rule');
      fireEvent.change(screen.getByLabelText(/Shift Type/i), { target: { value: 'day' } });
      fireEvent.change(screen.getByLabelText(/Day of Week/i), { target: { value: 'monday' } });
      await user.type(screen.getByLabelText(/Required Staff/i), '2');
      fireEvent.change(screen.getByLabelText(/Gender Preference/i), { target: { value: 'any' } });
      await user.type(screen.getByLabelText(/Required Qualifications/i), 'First Aid, Dementia Care');
      await user.type(screen.getByLabelText(/Priority/i), '1');

      // Submit the form
      const submitButton = screen.getByText('Create');
      fireEvent.click(submitButton);

      // Verify API call with parsed qualifications
      await waitFor(() => {
        expect(mockRulesAPI.create).toHaveBeenCalledWith({
          name: 'Test Rule',
          shiftType: 'day',
          dayOfWeek: 'monday',
          requiredStaff: 2,
          genderPreference: 'any',
          requiredQualifications: ['First Aid', 'Dementia Care'],
          priority: 1,
        });
      });
    });
  });
});
