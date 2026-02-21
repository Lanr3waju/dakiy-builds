import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import TaskForm from './TaskForm';
import TaskList from './TaskList';
import Timeline from './Timeline';
import TaskProgressUpdate from './TaskProgressUpdate';
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

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', username: 'testuser', role: 'Admin' },
  }),
}));

// Mock the Gantt component to avoid SVG issues in test environment
vi.mock('gantt-task-react', () => ({
  Gantt: ({ tasks }: any) => (
    <div data-testid="gantt-chart">
      {tasks.map((task: any) => (
        <div key={task.id} data-testid={`gantt-task-${task.id}`}>
          {task.name}
        </div>
      ))}
    </div>
  ),
  ViewMode: {
    Hour: 'Hour',
    Day: 'Day',
    Week: 'Week',
    Month: 'Month',
  },
}));

describe('Task Date-Based Tracking - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('User Flow 1: Create new task with dates through UI', () => {
    it('should create a task with dates and display it in task list with correct status', async () => {
      // Mock API responses
      const mockTask = {
        id: 'task-1',
        project_id: 'project-1',
        name: 'Test Task',
        phase: 'Foundation',
        start_date: '2024-06-01',
        end_date: '2024-06-15',
        duration: 14,
        progress: 0,
        status: 'not_started',
        days_remaining: 10,
        auto_progress_enabled: true,
        auto_progress: 0,
      };

      (apiClient.get as any).mockImplementation((url: string) => {
        if (url.includes('/tasks')) {
          return Promise.resolve({ data: { data: [] } });
        }
        if (url.includes('/users')) {
          return Promise.resolve({ data: { data: [] } });
        }
        return Promise.resolve({ data: { data: {} } });
      });

      (apiClient.post as any).mockResolvedValue({
        data: { data: mockTask },
      });

      // Render TaskForm
      const onSuccess = vi.fn();
      const { rerender } = render(<TaskForm projectId="project-1" onSuccess={onSuccess} />);

      // Fill in form fields
      const nameInput = screen.getByLabelText(/task name/i);
      const phaseInput = screen.getByLabelText(/phase/i);
      const startDateInput = screen.getByLabelText(/start date/i);
      const endDateInput = screen.getByLabelText(/end date/i);

      fireEvent.change(nameInput, { target: { value: 'Test Task' } });
      fireEvent.change(phaseInput, { target: { value: 'Foundation' } });
      fireEvent.change(startDateInput, { target: { value: '2024-06-01' } });
      fireEvent.change(endDateInput, { target: { value: '2024-06-15' } });

      // Verify duration is calculated
      await waitFor(() => {
        expect(screen.getByText(/14 days \(auto-calculated\)/i)).toBeInTheDocument();
      });

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create task/i });
      fireEvent.click(submitButton);

      // Verify API was called with correct data
      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith(
          '/projects/project-1/tasks',
          expect.objectContaining({
            name: 'Test Task',
            phase: 'Foundation',
            startDate: '2024-06-01',
            endDate: '2024-06-15',
            autoProgressEnabled: true,
          })
        );
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });

      // Now render TaskList with the created task
      (apiClient.get as any).mockImplementation((url: string) => {
        if (url.includes('/projects/project-1/tasks')) {
          return Promise.resolve({ data: { data: [mockTask] } });
        }
        return Promise.resolve({ data: { data: [] } });
      });

      rerender(<TaskList projectId="project-1" />);

      // Verify task appears in list with correct status
      await waitFor(() => {
        expect(screen.getByText('Test Task')).toBeInTheDocument();
        expect(screen.getByText(/Jun 1 - Jun 15/i)).toBeInTheDocument();
        expect(screen.getByText(/Starts in 10 days/i)).toBeInTheDocument();
        expect(screen.getByText(/Not Started/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Flow 2: Update task dates and verify recalculation', () => {
    it('should update task dates and recalculate duration and days remaining', async () => {
      const originalTask = {
        id: 'task-1',
        name: 'Test Task',
        phase: 'Foundation',
        start_date: '2024-06-01',
        end_date: '2024-06-15',
        duration: 14,
        progress: 50,
        status: 'in_progress',
        days_remaining: 5,
        auto_progress_enabled: true,
        auto_progress: 60,
      };

      const updatedTask = {
        ...originalTask,
        start_date: '2024-06-01',
        end_date: '2024-06-20',
        duration: 19,
        days_remaining: 10,
      };

      (apiClient.get as any).mockImplementation((url: string) => {
        if (url.includes('/tasks')) {
          return Promise.resolve({ data: { data: [] } });
        }
        if (url.includes('/users')) {
          return Promise.resolve({ data: { data: [] } });
        }
        return Promise.resolve({ data: { data: {} } });
      });

      (apiClient.put as any).mockResolvedValue({
        data: { data: updatedTask },
      });

      // Render TaskForm in edit mode
      const onSuccess = vi.fn();
      render(
        <TaskForm
          projectId="project-1"
          taskId="task-1"
          initialData={originalTask}
          onSuccess={onSuccess}
        />
      );

      // Set start date first (since initialData doesn't populate date fields)
      const startDateInput = screen.getByLabelText(/start date/i);
      fireEvent.change(startDateInput, { target: { value: '2024-06-01' } });

      // Update end date
      const endDateInput = screen.getByLabelText(/end date/i);
      fireEvent.change(endDateInput, { target: { value: '2024-06-20' } });

      // Verify duration is recalculated
      await waitFor(() => {
        expect(screen.getByText(/19 days \(auto-calculated\)/i)).toBeInTheDocument();
      });

      // Submit form
      const submitButton = screen.getByRole('button', { name: /update task/i });
      fireEvent.click(submitButton);

      // Verify API was called
      await waitFor(() => {
        expect(apiClient.put).toHaveBeenCalledWith(
          '/tasks/task-1',
          expect.objectContaining({
            startDate: '2024-06-01',
            endDate: '2024-06-20',
          })
        );
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('User Flow 3: View timeline with date ranges', () => {
    it('should display tasks in timeline with accurate date ranges', async () => {
      const mockTimelineData = {
        project: {
          id: 'project-1',
          name: 'Test Project',
          start_date: '2024-06-01',
          planned_completion_date: '2024-12-31',
        },
        tasks: [
          {
            id: 'task-1',
            name: 'Foundation Work',
            phase: 'Foundation',
            estimated_duration_days: 14,
            progress_percentage: 50,
            is_completed: false,
            assigned_to: 'user-1',
            assigned_to_name: 'John Doe',
            dependencies: [],
            start_date: '2024-06-01',
            end_date: '2024-06-15',
          },
          {
            id: 'task-2',
            name: 'Framing',
            phase: 'Framing',
            estimated_duration_days: 20,
            progress_percentage: 0,
            is_completed: false,
            assigned_to: 'user-2',
            assigned_to_name: 'Jane Smith',
            dependencies: [{ depends_on_task_id: 'task-1' }],
            start_date: '2024-06-16',
            end_date: '2024-07-05',
          },
        ],
      };

      (apiClient.get as any).mockImplementation((url: string) => {
        if (url.includes('/timeline')) {
          return Promise.resolve({ data: { data: mockTimelineData } });
        }
        return Promise.resolve({ data: { data: {} } });
      });

      render(<Timeline projectId="project-1" />);

      // Wait for timeline to load
      await waitFor(() => {
        expect(screen.getByText('Project Timeline')).toBeInTheDocument();
      });

      // Verify tasks are displayed
      await waitFor(() => {
        expect(screen.getByText('Foundation Work')).toBeInTheDocument();
        expect(screen.getByText('Framing')).toBeInTheDocument();
      });

      // Verify legend is displayed
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Delayed')).toBeInTheDocument();
    });
  });

  describe('User Flow 4: Toggle auto/manual progress mode', () => {
    it('should toggle between auto and manual progress modes and update correctly', async () => {
      const mockTask = {
        id: 'task-1',
        name: 'Test Task',
        start_date: '2024-06-01',
        end_date: '2024-06-15',
        auto_progress_enabled: true,
        auto_progress: 60,
        progress: 60,
      };

      (apiClient.get as any).mockImplementation((url: string) => {
        if (url.includes('/progress')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: { data: {} } });
      });

      (apiClient.put as any).mockResolvedValue({
        data: { data: { ...mockTask, auto_progress_enabled: false } },
      });

      const onSuccess = vi.fn();
      render(
        <TaskProgressUpdate
          taskId="task-1"
          currentProgress={60}
          autoProgressEnabled={true}
          autoProgress={60}
          startDate="2024-06-01"
          endDate="2024-06-15"
          onSuccess={onSuccess}
        />
      );

      // Verify auto mode is displayed
      await waitFor(() => {
        expect(screen.getByText(/🤖 Auto/i)).toBeInTheDocument();
        expect(screen.getByText(/Automatic Progress: 60%/i)).toBeInTheDocument();
      });

      // Toggle to manual mode
      const toggleCheckbox = screen.getByRole('checkbox');
      fireEvent.click(toggleCheckbox);

      // Verify API was called to update mode
      await waitFor(() => {
        expect(apiClient.put).toHaveBeenCalledWith(
          '/tasks/task-1',
          expect.objectContaining({
            autoProgressEnabled: false,
          })
        );
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('should allow manual progress update in manual mode', async () => {
      (apiClient.get as any).mockImplementation((url: string) => {
        if (url.includes('/progress')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: { data: {} } });
      });

      (apiClient.post as any).mockResolvedValue({
        data: { success: true },
      });

      const onSuccess = vi.fn();
      render(
        <TaskProgressUpdate
          taskId="task-1"
          currentProgress={50}
          autoProgressEnabled={false}
          autoProgress={60}
          startDate="2024-06-01"
          endDate="2024-06-15"
          onSuccess={onSuccess}
        />
      );

      // Verify manual mode is displayed
      await waitFor(() => {
        expect(screen.getByText(/✋ Manual/i)).toBeInTheDocument();
      });

      // Update progress
      const progressSlider = screen.getByLabelText(/Progress:/i);
      fireEvent.change(progressSlider, { target: { value: '75' } });

      // Submit progress update
      const submitButton = screen.getByRole('button', { name: /update progress/i });
      fireEvent.click(submitButton);

      // Verify API was called
      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith(
          '/tasks/task-1/progress',
          expect.objectContaining({
            progress: 75,
          })
        );
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('User Flow 5: Create task with invalid date range', () => {
    it('should show validation error when end date is before start date', async () => {
      (apiClient.get as any).mockImplementation((url: string) => {
        if (url.includes('/tasks')) {
          return Promise.resolve({ data: { data: [] } });
        }
        if (url.includes('/users')) {
          return Promise.resolve({ data: { data: [] } });
        }
        return Promise.resolve({ data: { data: {} } });
      });

      render(<TaskForm projectId="project-1" />);

      // Fill in form with invalid date range
      const nameInput = screen.getByLabelText(/task name/i);
      const phaseInput = screen.getByLabelText(/phase/i);
      const startDateInput = screen.getByLabelText(/start date/i);
      const endDateInput = screen.getByLabelText(/end date/i);

      fireEvent.change(nameInput, { target: { value: 'Test Task' } });
      fireEvent.change(phaseInput, { target: { value: 'Foundation' } });
      fireEvent.change(startDateInput, { target: { value: '2024-06-15' } });
      fireEvent.change(endDateInput, { target: { value: '2024-06-10' } }); // End before start

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create task/i });
      fireEvent.click(submitButton);

      // Verify error message is displayed
      await waitFor(() => {
        expect(screen.getByText('End date must be after start date')).toBeInTheDocument();
      });

      // Verify form was not submitted
      expect(apiClient.post).not.toHaveBeenCalled();
    });
  });

  describe('User Flow 6: View legacy tasks (duration-based)', () => {
    it('should display legacy tasks without dates correctly', async () => {
      const mockLegacyTask = {
        id: 'legacy-task-1',
        project_id: 'project-1',
        name: 'Legacy Task',
        phase: 'Foundation',
        duration_days: 10,
        progress: 50,
        status: 'in_progress',
        // No start_date, end_date, or days_remaining
      };

      const mockDateBasedTask = {
        id: 'task-1',
        project_id: 'project-1',
        name: 'Date-Based Task',
        phase: 'Foundation',
        start_date: '2024-06-01',
        end_date: '2024-06-15',
        duration: 14,
        progress: 60,
        status: 'in_progress',
        days_remaining: 5,
        auto_progress_enabled: true,
        auto_progress: 60,
      };

      (apiClient.get as any).mockImplementation((url: string) => {
        if (url.includes('/projects/project-1/tasks')) {
          return Promise.resolve({ data: { data: [mockLegacyTask, mockDateBasedTask] } });
        }
        return Promise.resolve({ data: { data: [] } });
      });

      render(<TaskList projectId="project-1" />);

      // Wait for tasks to load
      await waitFor(() => {
        expect(screen.getByText('Legacy Task')).toBeInTheDocument();
        expect(screen.getByText('Date-Based Task')).toBeInTheDocument();
      });

      // Verify legacy task displays duration but not dates
         // Verify legacy task displays duration but not dates
      const legacyTaskElement = screen.getByText('Legacy Task').closest('.task-item');
      expect(legacyTaskElement).toBeInTheDocument();
      if (legacyTaskElement) {
        expect(within(legacyTaskElement as HTMLElement).getByText(/Duration: 10 days/i)).toBeInTheDocument();
        // Should not have date range or days remaining
        expect(within(legacyTaskElement as HTMLElement).queryByText(/Jun/i)).not.toBeInTheDocument();
      }

      // Verify date-based task displays dates and days remaining
      const dateTaskElement = screen.getByText('Date-Based Task').closest('.task-item');
      expect(dateTaskElement).toBeInTheDocument();
      if (dateTaskElement) {
        expect(within(dateTaskElement as HTMLElement).getByText(/Jun 1 - Jun 15/i)).toBeInTheDocument();
        expect(within(dateTaskElement as HTMLElement).getByText(/5 days remaining/i)).toBeInTheDocument();
        expect(within(dateTaskElement as HTMLElement).getByText(/Duration: 14 days/i)).toBeInTheDocument();
      }
    });

    it('should display legacy tasks in timeline using calculated dates', async () => {
      const mockTimelineData = {
        project: {
          id: 'project-1',
          name: 'Test Project',
          start_date: '2024-06-01',
          planned_completion_date: '2024-12-31',
        },
        tasks: [
          {
            id: 'legacy-task-1',
            name: 'Legacy Task',
            phase: 'Foundation',
            estimated_duration_days: 10,
            progress_percentage: 50,
            is_completed: false,
            assigned_to: 'user-1',
            assigned_to_name: 'John Doe',
            dependencies: [],
            // No start_date or end_date
          },
          {
            id: 'task-1',
            name: 'Date-Based Task',
            phase: 'Foundation',
            estimated_duration_days: 14,
            progress_percentage: 60,
            is_completed: false,
            assigned_to: 'user-2',
            assigned_to_name: 'Jane Smith',
            dependencies: [],
            start_date: '2024-06-01',
            end_date: '2024-06-15',
          },
        ],
      };

      (apiClient.get as any).mockImplementation((url: string) => {
        if (url.includes('/timeline')) {
          return Promise.resolve({ data: { data: mockTimelineData } });
        }
        return Promise.resolve({ data: { data: {} } });
      });

      render(<Timeline projectId="project-1" />);

      // Wait for timeline to load
      await waitFor(() => {
        expect(screen.getByText('Project Timeline')).toBeInTheDocument();
      });

      // Verify both tasks are displayed
      await waitFor(() => {
        expect(screen.getByText('Legacy Task')).toBeInTheDocument();
        expect(screen.getByText('Date-Based Task')).toBeInTheDocument();
      });
    });
  });

  describe('User Flow 7: Complete end-to-end workflow', () => {
    it('should handle complete workflow from creation to progress update', async () => {
      const mockTask = {
        id: 'task-1',
        project_id: 'project-1',
        name: 'Complete Workflow Task',
        phase: 'Foundation',
        start_date: '2024-06-01',
        end_date: '2024-06-15',
        duration: 14,
        progress: 0,
        status: 'not_started',
        days_remaining: 10,
        auto_progress_enabled: true,
        auto_progress: 0,
      };

      // Step 1: Create task
      (apiClient.get as any).mockImplementation((url: string) => {
        if (url.includes('/tasks')) {
          return Promise.resolve({ data: { data: [] } });
        }
        if (url.includes('/users')) {
          return Promise.resolve({ data: { data: [] } });
        }
        return Promise.resolve({ data: { data: {} } });
      });

      (apiClient.post as any).mockResolvedValue({
        data: { data: mockTask },
      });

      const onSuccess = vi.fn();
      const { unmount } = render(<TaskForm projectId="project-1" onSuccess={onSuccess} />);

      // Fill and submit form
      fireEvent.change(screen.getByLabelText(/task name/i), {
        target: { value: 'Complete Workflow Task' },
      });
      fireEvent.change(screen.getByLabelText(/phase/i), { target: { value: 'Foundation' } });
      fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2024-06-01' } });
      fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2024-06-15' } });

      fireEvent.click(screen.getByRole('button', { name: /create task/i }));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalled();
      });

      unmount();

      // Step 2: View in task list
      (apiClient.get as any).mockImplementation((url: string) => {
        if (url.includes('/projects/project-1/tasks')) {
          return Promise.resolve({ data: { data: [mockTask] } });
        }
        return Promise.resolve({ data: { data: [] } });
      });

      const { unmount: unmountList } = render(<TaskList projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('Complete Workflow Task')).toBeInTheDocument();
        expect(screen.getByText(/Not Started/i)).toBeInTheDocument();
      });

      unmountList();

      // Step 3: Update progress
      (apiClient.get as any).mockImplementation((url: string) => {
        if (url.includes('/progress')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: { data: {} } });
      });

      (apiClient.put as any).mockResolvedValue({
        data: { data: { ...mockTask, auto_progress_enabled: false } },
      });

      (apiClient.post as any).mockResolvedValue({
        data: { success: true },
      });

      render(
        <TaskProgressUpdate
          taskId="task-1"
          currentProgress={0}
          autoProgressEnabled={true}
          autoProgress={0}
          startDate="2024-06-01"
          endDate="2024-06-15"
          onSuccess={onSuccess}
        />
      );

      // Toggle to manual mode
      const toggleCheckbox = screen.getByRole('checkbox');
      fireEvent.click(toggleCheckbox);

      await waitFor(() => {
        expect(apiClient.put).toHaveBeenCalledWith(
          '/tasks/task-1',
          expect.objectContaining({
            autoProgressEnabled: false,
          })
        );
      });

      // Update progress to 50%
      const progressSlider = screen.getByLabelText(/Progress:/i);
      fireEvent.change(progressSlider, { target: { value: '50' } });

      const submitButton = screen.getByRole('button', { name: /update progress/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith(
          '/tasks/task-1/progress',
          expect.objectContaining({
            progress: 50,
          })
        );
      });
    });
  });
});
