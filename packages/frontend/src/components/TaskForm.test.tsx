import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaskForm from './TaskForm';
import apiClient from '../lib/api';

// Mock the API client
vi.mock('../lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('TaskForm Date Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock API responses
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url.includes('/tasks')) {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url.includes('/users')) {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.resolve({ data: { data: {} } });
    });
  });

  it('should validate that end date is after start date', async () => {
    render(<TaskForm projectId="test-project" />);

    // Fill in required fields
    const nameInput = screen.getByLabelText(/task name/i);
    const phaseInput = screen.getByLabelText(/phase/i);
    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);

    fireEvent.change(nameInput, { target: { value: 'Test Task' } });
    fireEvent.change(phaseInput, { target: { value: 'Foundation' } });
    fireEvent.change(startDateInput, { target: { value: '2024-01-15' } });
    fireEvent.change(endDateInput, { target: { value: '2024-01-10' } }); // End before start

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create task/i });
    fireEvent.click(submitButton);

    // Check for error message
    await waitFor(() => {
      expect(screen.getByText('End date must be after start date')).toBeInTheDocument();
    });

    // Verify form was not submitted
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('should show warning when start date is in the past', async () => {
    render(<TaskForm projectId="test-project" />);

    const nameInput = screen.getByLabelText(/task name/i);
    const phaseInput = screen.getByLabelText(/phase/i);
    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);
    
    // Fill required fields
    fireEvent.change(nameInput, { target: { value: 'Test Task' } });
    fireEvent.change(phaseInput, { target: { value: 'Foundation' } });
    
    // Set a past date (use a fixed past date to avoid timezone issues)
    fireEvent.change(startDateInput, { target: { value: '2020-01-01' } });
    fireEvent.change(endDateInput, { target: { value: '2020-01-15' } });

    // Submit to trigger validation
    const submitButton = screen.getByRole('button', { name: /create task/i });
    fireEvent.click(submitButton);

    // Check for warning message
    await waitFor(() => {
      expect(screen.getByText('Start date is in the past')).toBeInTheDocument();
    });
  });

  it('should allow form submission with valid date range', async () => {
    (apiClient.post as any).mockResolvedValue({
      data: { data: { id: 'new-task-id' } },
    });

    const onSuccess = vi.fn();
    render(<TaskForm projectId="test-project" onSuccess={onSuccess} />);

    // Fill in all required fields with valid data
    const nameInput = screen.getByLabelText(/task name/i);
    const phaseInput = screen.getByLabelText(/phase/i);
    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);

    fireEvent.change(nameInput, { target: { value: 'Test Task' } });
    fireEvent.change(phaseInput, { target: { value: 'Foundation' } });
    fireEvent.change(startDateInput, { target: { value: '2024-01-10' } });
    fireEvent.change(endDateInput, { target: { value: '2024-01-20' } }); // Valid range

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create task/i });
    fireEvent.click(submitButton);

    // Verify form was submitted
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/projects/test-project/tasks',
        expect.objectContaining({
          name: 'Test Task',
          phase: 'Foundation',
          startDate: '2024-01-10',
          endDate: '2024-01-20',
        })
      );
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('should calculate duration correctly', async () => {
    render(<TaskForm projectId="test-project" />);

    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);

    fireEvent.change(startDateInput, { target: { value: '2024-01-01' } });
    fireEvent.change(endDateInput, { target: { value: '2024-01-15' } });

    // Check duration display
    await waitFor(() => {
      expect(screen.getByText(/14 days \(auto-calculated\)/i)).toBeInTheDocument();
    });
  });

  it('should prevent submission when required fields are missing', async () => {
    render(<TaskForm projectId="test-project" />);

    // Submit form without filling fields
    const submitButton = screen.getByRole('button', { name: /create task/i });
    fireEvent.click(submitButton);

    // Check for error messages
    await waitFor(() => {
      expect(screen.getByText('Task name is required')).toBeInTheDocument();
      expect(screen.getByText('Phase is required')).toBeInTheDocument();
      expect(screen.getByText('Start date is required')).toBeInTheDocument();
      expect(screen.getByText('End date is required')).toBeInTheDocument();
    });

    // Verify form was not submitted
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
