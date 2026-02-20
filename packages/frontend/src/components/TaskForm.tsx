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
  duration_days: string;
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
    duration_days: initialData?.duration_days?.toString() || '',
    assigned_to: initialData?.assigned_to || '',
    status: initialData?.status || 'pending',
  });

  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([]);
  const [existingDependencies, setExistingDependencies] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
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
      const tasks = response.data.filter((task: Task) => task.id !== taskId);
      setAvailableTasks(tasks);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const response = await apiClient.get('/users');
      setAvailableUsers(response.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchExistingDependencies = async () => {
    try {
      const response = await apiClient.get(`/tasks/${taskId}`);
      if (response.data.dependencies) {
        setExistingDependencies(response.data.dependencies);
        setSelectedDependencies(response.data.dependencies);
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

    if (!formData.name.trim()) {
      newErrors.name = 'Task name is required';
    }

    if (!formData.phase.trim()) {
      newErrors.phase = 'Phase is required';
    }

    if (!formData.duration_days || parseFloat(formData.duration_days) <= 0) {
      newErrors.duration_days = 'Duration must be a positive number';
    }

    if (taskId && !validateCircularDependency(selectedDependencies)) {
      newErrors.dependencies = 'Circular dependency detected. Please remove conflicting dependencies.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
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
        ...formData,
        duration_days: parseFloat(formData.duration_days),
        assigned_to: formData.assigned_to || undefined,
      };

      let createdTaskId = taskId;

      if (taskId) {
        await apiClient.put(`/tasks/${taskId}`, taskData);
      } else {
        const response = await apiClient.post(`/projects/${projectId}/tasks`, taskData);
        createdTaskId = response.data.id;
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

          <div className="form-group">
            <label htmlFor="duration_days">
              Duration (days) <span className="required">*</span>
            </label>
            <input
              type="number"
              id="duration_days"
              name="duration_days"
              value={formData.duration_days}
              onChange={handleInputChange}
              min="0"
              step="0.5"
              className={errors.duration_days ? 'error' : ''}
            />
            {errors.duration_days && (
              <span className="error-message">{errors.duration_days}</span>
            )}
          </div>
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
              {availableUsers.map((user) => (
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
