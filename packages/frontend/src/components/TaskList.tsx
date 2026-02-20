import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../lib/api';
import '../styles/TaskList.css';

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
  created_at: string;
  updated_at: string;
  dependencies?: string[];
}

interface TaskListProps {
  projectId: string;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  onUpdateProgress?: (task: Task) => void;
  onRefresh?: () => void;
}

function TaskList({ projectId, onEditTask, onDeleteTask, onUpdateProgress, onRefresh }: TaskListProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTasks();
  }, [projectId]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/projects/${projectId}/tasks`);
      setTasks(response.data);
      setError(null);
      
      // Expand all phases by default
      const phases = new Set<string>(response.data.map((task: Task) => task.phase));
      setExpandedPhases(phases);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      await apiClient.delete(`/tasks/${taskId}`);
      await fetchTasks();
      if (onDeleteTask) {
        onDeleteTask(taskId);
      }
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete task');
    }
  };

  const togglePhase = (phase: string) => {
    setExpandedPhases((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(phase)) {
        newSet.delete(phase);
      } else {
        newSet.add(phase);
      }
      return newSet;
    });
  };

  const groupTasksByPhase = () => {
    const grouped: Record<string, Task[]> = {};
    tasks.forEach((task) => {
      if (!grouped[task.phase]) {
        grouped[task.phase] = [];
      }
      grouped[task.phase].push(task);
    });
    return grouped;
  };

  const calculatePhaseProgress = (phaseTasks: Task[]) => {
    if (phaseTasks.length === 0) return 0;
    const totalProgress = phaseTasks.reduce((sum, task) => sum + task.progress, 0);
    return Math.round(totalProgress / phaseTasks.length);
  };

  const getDependencyNames = (taskId: string): string[] => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.dependencies || task.dependencies.length === 0) {
      return [];
    }
    return task.dependencies
      .map((depId) => {
        const depTask = tasks.find((t) => t.id === depId);
        return depTask ? depTask.name : null;
      })
      .filter((name): name is string => name !== null);
  };

  const canEdit = user?.role === 'Admin' || user?.role === 'Project_Manager';
  const canDelete = user?.role === 'Admin' || user?.role === 'Project_Manager';

  if (loading) {
    return <div className="task-list-loading">Loading tasks...</div>;
  }

  if (error) {
    return <div className="task-list-error">{error}</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="task-list-empty">
        <p>No tasks created yet</p>
      </div>
    );
  }

  const groupedTasks = groupTasksByPhase();
  const phases = Object.keys(groupedTasks).sort();

  return (
    <div className="task-list">
      {phases.map((phase) => {
        const phaseTasks = groupedTasks[phase];
        const phaseProgress = calculatePhaseProgress(phaseTasks);
        const isExpanded = expandedPhases.has(phase);

        return (
          <div key={phase} className="phase-group">
            <div className="phase-header" onClick={() => togglePhase(phase)}>
              <div className="phase-title">
                <span className="phase-toggle">{isExpanded ? '▼' : '▶'}</span>
                <h3>{phase}</h3>
                <span className="phase-count">({phaseTasks.length} tasks)</span>
              </div>
              <div className="phase-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${phaseProgress}%` }}
                  />
                </div>
                <span className="progress-text">{phaseProgress}%</span>
              </div>
            </div>

            {isExpanded && (
              <div className="phase-tasks">
                {phaseTasks.map((task) => {
                  const dependencyNames = getDependencyNames(task.id);

                  return (
                    <div key={task.id} className="task-item">
                      <div className="task-main">
                        <div className="task-info">
                          <h4 className="task-name">{task.name}</h4>
                          {task.description && (
                            <p className="task-description">{task.description}</p>
                          )}
                          <div className="task-meta">
                            <span className="task-duration">
                              Duration: {task.duration_days} days
                            </span>
                            {task.assigned_to && (
                              <span className="task-assigned">
                                Assigned to: {task.assigned_to}
                              </span>
                            )}
                            <span className={`task-status status-${task.status}`}>
                              {task.status}
                            </span>
                          </div>
                          {dependencyNames.length > 0 && (
                            <div className="task-dependencies">
                              <span className="dependencies-label">Depends on:</span>
                              <span className="dependencies-list">
                                {dependencyNames.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="task-progress-section">
                          <div className="progress-bar">
                            <div
                              className="progress-fill"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                          <span className="progress-text">{task.progress}%</span>
                        </div>
                      </div>

                      <div className="task-actions">
                        {onUpdateProgress && (
                          <button
                            className="btn-icon"
                            onClick={() => onUpdateProgress(task)}
                            title="Update progress"
                          >
                            📊
                          </button>
                        )}
                        {canEdit && (
                          <button
                            className="btn-icon"
                            onClick={() => onEditTask && onEditTask(task)}
                            title="Edit task"
                          >
                            ✏️
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="btn-icon"
                            onClick={() => handleDelete(task.id)}
                            title="Delete task"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default TaskList;
