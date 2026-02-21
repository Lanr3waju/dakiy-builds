import { useState, useEffect } from 'react';
import apiClient from '../lib/api';
import '../styles/TaskForm.css';

interface Task {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  phase: string;
  duration_days: number;
  assigned_to?: string;
  progress: number;
  status: string;
  dependencies?: string[];
}

interface TaskFormData {
  name: string;
  description: string;
  phase: string;
  startDate: string;
  endDate: string;
  autoProgressEnabled: boolean;
  assigned_to: string;
  status: string;
}

interface TaskFormProps {
  projectId: string;
  taskId?: string;
  initialData?: Partial<Task>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface User {
  id: string;
  username: string;
  email: string;
}

function TaskForm({ projectId, taskId, initialData, onSuccess, onCancel }: TaskFormProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    phase: initialData?.phase || '',
    startDate: '',
    endDate: '',
    autoProgressEnabled: true,
    assigned_to: initialData?.assigned_to || '',
    status: initialData?.status || 'pending',
  });

  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([]);
  const [existingDependencies, setExistingDependencies] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetchAvailableTasks();
    fetchAvailableUsers();
    if (taskId) {
      fetchExistingDependencies();
    }
  }, [projectId, taskId]);

  const fetchAvailableTasks = async () => {
    try {
      const response = await apiClient.get(`/projects/${projectId}/tasks`);
      // Backend returns { success: true, data: tasks }
      const tasksData = response.data.data || response.data || [];
      const tasks = (Array.isArray(tasksData) ? tasksData : []).filter((task: Task) => task.id !== taskId);
      setAvailableTasks(tasks);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setAvailableTasks([]);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const response = await apiClient.get('/users');
      // Backend returns { success: true, data: users }
      const users = response.data.data || response.data || [];
      setAvailableUsers(Array.isArray(users) ? users : []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setAvailableUsers([]);
    }
  };

  const fetchExistingDependencies = async () => {
    try {
      const response = await apiClient.get(`/tasks/${taskId}`);
      // Backend returns { success: true, data: task }
      const taskData = response.data.data || response.data;
      if (taskData.dependencies) {
        setExistingDependencies(taskData.dependencies);
        setSelectedDependencies(taskData.dependencies);
      }
    } catch (err) {
      console.error('Failed to fetch dependencies:', err);
    }
  };

  const validateCircularDependency = (newDependencies: string[]): boolean => {
    if (!taskId) return true;

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (currentTaskId: string): boolean => {
      if (recursionStack.has(currentTaskId)) {
        return true;
      }

      if (visited.has(currentTaskId)) {
        return false;
      }

      visited.add(currentTaskId);
      recursionStack.add(currentTaskId);

      const currentTask = availableTasks.find((t) => t.id === currentTaskId);
      const dependencies =
        currentTaskId === taskId ? newDependencies : currentTask?.dependencies || [];

      for (const depId of dependencies) {
        if (hasCycle(depId)) {
          return true;
        }
      }

      recursionStack.delete(currentTaskId);
      return false;
    };

    return !hasCycle(taskId);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const newWarnings: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Task name is required';
    }

    if (!formData.phase.trim()) {
      newErrors.phase = 'Phase is required';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    }

    if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) {
      newErrors.endDate = 'End date must be after start date';
    }

    // Optional warning for past start date
    if (formData.startDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison
      const startDate = new Date(formData.startDate);
      
      if (startDate < today) {
        newWarnings.startDate = 'Start date is in the past';
      }
    }

    if (taskId && !validateCircularDependency(selectedDependencies)) {
      newErrors.dependencies = 'Circular dependency detected. Please remove conflicting dependencies.';
    }

    setErrors(newErrors);
    setWarnings(newWarnings);
    return Object.keys(newErrors).length === 0;
  };

  const calculateDuration = (): number | null => {
    if (!formData.startDate || !formData.endDate) {
      return null;
    }
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData((prev) => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
    
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    
    if (warnings[name]) {
      setWarnings((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleDependencyToggle = (taskId: string) => {
    setSelectedDependencies((prev) => {
      const newDeps = prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId];

      // Clear dependency error when user makes changes
      if (errors.dependencies) {
        setErrors((prev) => ({ ...prev, dependencies: '' }));
      }

      return newDeps;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const taskData = {
        name: formData.name,
        description: formData.description,
        phase: formData.phase,
        startDate: formData.startDate,
        endDate: formData.endDate,
        autoProgressEnabled: formData.autoProgressEnabled,
        assigned_to: formData.assigned_to || undefined,
        status: formData.status,
      };

      let createdTaskId = taskId;

      if (taskId) {
        await apiClient.put(`/tasks/${taskId}`, taskData);
      } else {
        const response = await apiClient.post(`/projects/${projectId}/tasks`, taskData);
        // Backend returns { success: true, data: task }
        const task = response.data.data || response.data;
        createdTaskId = task.id;
      }

      // Update dependencies
      if (createdTaskId) {
        // Remove old dependencies
        const depsToRemove = existingDependencies.filter(
          (dep) => !selectedDependencies.includes(dep)
        );
        for (const depId of depsToRemove) {
          try {
            await apiClient.delete(`/tasks/${createdTaskId}/dependencies/${depId}`);
          } catch (err) {
            console.error('Failed to remove dependency:', err);
          }
        }

        // Add new dependencies
        const depsToAdd = selectedDependencies.filter(
          (dep) => !existingDependencies.includes(dep)
        );
        for (const depId of depsToAdd) {
          try {
            await apiClient.post(`/tasks/${createdTaskId}/dependencies`, {
              depends_on_task_id: depId,
            });
          } catch (err: any) {
            if (err.response?.data?.message?.includes('circular')) {
              setSubmitError('Circular dependency detected. Please adjust dependencies.');
              setLoading(false);
              return;
            }
            console.error('Failed to add dependency:', err);
          }
        }
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setSubmitError(err.response?.data?.message || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  const groupTasksByPhase = () => {
    const grouped: Record<string, Task[]> = {};
    availableTasks.forEach((task) => {
      if (!grouped[task.phase]) {
        grouped[task.phase] = [];
      }
      grouped[task.phase].push(task);
    });
    return grouped;
  };

  const groupedTasks = groupTasksByPhase();
  const phases = Object.keys(groupedTasks).sort();

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <div className="form-section">
        <h3>Task Details</h3>

        <div className="form-group">
          <label htmlFor="name">
            Task Name <span className="required">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className={errors.name ? 'error' : ''}
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="phase">
              Phase <span className="required">*</span>
            </label>
            <input
              type="text"
              id="phase"
              name="phase"
              value={formData.phase}
              onChange={handleInputChange}
              placeholder="e.g., Foundation, Framing, Finishing"
              className={errors.phase ? 'error' : ''}
            />
            {errors.phase && <span className="error-message">{errors.phase}</span>}
          </div>
        </div>

        <div className="form-section date-range-section">
          <h4>Date Range</h4>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startDate">
                Start Date <span className="required">*</span>
              </label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
                className={errors.startDate ? 'error' : ''}
              />
              {errors.startDate && <span className="error-message">{errors.startDate}</span>}
              {warnings.startDate && <span className="warning-message">{warnings.startDate}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="endDate">
                End Date <span className="required">*</span>
              </label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
                className={errors.endDate ? 'error' : ''}
              />
              {errors.endDate && <span className="error-message">{errors.endDate}</span>}
            </div>
          </div>

          <div className="form-group">
            <label className="duration-display-label">Duration</label>
            <div className="duration-display">
              {calculateDuration() !== null 
                ? `${calculateDuration()} days (auto-calculated)` 
                : 'Select start and end dates'}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="autoProgressEnabled"
              checked={formData.autoProgressEnabled}
              onChange={handleInputChange}
            />
            <span>Enable automatic progress calculation (based on elapsed time)</span>
          </label>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="assigned_to">Assigned To</label>
            <select
              id="assigned_to"
              name="assigned_to"
              value={formData.assigned_to}
              onChange={handleInputChange}
            >
              <option value="">Unassigned</option>
              {(Array.isArray(availableUsers) ? availableUsers : []).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username} ({user.email})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" value={formData.status} onChange={handleInputChange}>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3>Dependencies</h3>
        <p className="section-description">
          Select tasks that must be completed before this task can start
        </p>

        {errors.dependencies && (
          <div className="error-message-box">{errors.dependencies}</div>
        )}

        {availableTasks.length === 0 ? (
          <p className="empty-state">No other tasks available</p>
        ) : (
          <div className="dependencies-list">
            {phases.map((phase) => (
              <div key={phase} className="dependency-phase">
                <h4 className="phase-title">{phase}</h4>
                <div className="dependency-options">
                  {groupedTasks[phase].map((task) => (
                    <label key={task.id} className="dependency-option">
                      <input
                        type="checkbox"
                        checked={selectedDependencies.includes(task.id)}
                        onChange={() => handleDependencyToggle(task.id)}
                      />
                      <span className="dependency-name">{task.name}</span>
                      <span className="dependency-meta">
                        {task.duration_days} days • {task.progress}% complete
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {submitError && <div className="submit-error">{submitError}</div>}

      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : taskId ? 'Update Task' : 'Create Task'}
        </button>
      </div>
    </form>
  );
}

export default TaskForm;
