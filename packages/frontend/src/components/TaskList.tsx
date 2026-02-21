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
  progress_percentage: number;
  status: string;
  created_at: string;
  updated_at: string;
  dependencies?: string[];
  // Date-based tracking fields
  start_date?: string;
  end_date?: string;
  days_remaining?: number | null;
  auto_progress_enabled?: boolean;
  auto_progress?: number;
  duration?: number;
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

  // Helper function to format date range
  const formatDateRange = (startDate?: string, endDate?: string): string => {
    if (!startDate || !endDate) return '';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  // Helper function to get days remaining text
  const getDaysRemainingText = (task: Task): string => {
    if (task.status === 'completed') return 'Completed';
    
    // For legacy tasks without dates, don't show days remaining
    if (task.days_remaining === null || task.days_remaining === undefined) return '';
    
    const days = task.days_remaining;
    
    if (task.status === 'not_started') {
      return `Starts in ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`;
    } else if (days < 0) {
      return `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`;
    } else if (days === 0) {
      return 'Due today';
    } else {
      return `${days} day${days !== 1 ? 's' : ''} remaining`;
    }
  };

  // Helper function to get status badge info
  const getStatusBadge = (status: string): { icon: string; label: string; className: string } => {
    switch (status) {
      case 'not_started':
        return { icon: '⚪', label: 'Not Started', className: 'status-not-started' };
      case 'in_progress':
        return { icon: '🟢', label: 'On Track', className: 'status-on-track' };
      case 'overdue':
        return { icon: '🔴', label: 'Overdue', className: 'status-overdue' };
      case 'completed':
        return { icon: '🔵', label: 'Completed', className: 'status-completed' };
      default:
        return { icon: '⚪', label: status, className: 'status-default' };
    }
  };

  // Helper function to determine if task is at risk (in progress but behind schedule)
  const isTaskAtRisk = (task: Task): boolean => {
    if (task.status !== 'in_progress') return false;
    if (!task.auto_progress_enabled || task.auto_progress === undefined) return false;
    
    // Task is at risk if actual progress is significantly behind auto progress
    return task.progress_percentage < task.auto_progress - 10;
  };

  // Get adjusted status badge for at-risk tasks
  const getAdjustedStatusBadge = (task: Task) => {
    const badge = getStatusBadge(task.status);
    
    if (isTaskAtRisk(task)) {
      return { icon: '🟡', label: 'At Risk', className: 'status-at-risk' };
    }
    
    return badge;
  };

  useEffect(() => {
    fetchTasks();
  }, [projectId]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/projects/${projectId}/tasks`);
      // Backend returns { success: true, data: tasks }
      const tasksData = response.data.data || response.data || [];
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setError(null);
      
      // Expand all phases by default
      const phases = new Set<string>((Array.isArray(tasksData) ? tasksData : []).map((task: Task) => task.phase));
      setExpandedPhases(phases);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load tasks');
      setTasks([]);
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
    const totalProgress = phaseTasks.reduce((sum, task) => sum + task.progress_percentage, 0);
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
                <span className="progress-text">{phaseProgress || 0}%</span>
              </div>
            </div>

            {isExpanded && (
              <div className="phase-tasks">
                {phaseTasks.map((task) => {
                  const dependencyNames = getDependencyNames(task.id);
                  const statusBadge = getAdjustedStatusBadge(task);
                  const dateRange = formatDateRange(task.start_date, task.end_date);
                  const daysRemainingText = getDaysRemainingText(task);

                  return (
                    <div key={task.id} className="task-item">
                      <div className="task-main">
                        <div className="task-info">
                          <h4 className="task-name">{task.name}</h4>
                          {task.description && (
                            <p className="task-description">{task.description}</p>
                          )}
                          
                          {/* Date range and days remaining - only show for date-based tasks */}
                          {dateRange && (
                            <div className="task-dates">
                              <span className="date-range">📅 {dateRange}</span>
                              {daysRemainingText && (
                                <span className={`days-remaining ${statusBadge.className}`}>
                                  ⏱ {daysRemainingText}
                                </span>
                              )}
                            </div>
                          )}
                          
                          <div className="task-meta">
                            {/* Show duration from dates if available, otherwise fall back to duration_days */}
                            <span className="task-duration">
                              Duration: {task.duration || task.duration_days} days
                            </span>
                            {task.assigned_to && (
                              <span className="task-assigned">
                                👤 {task.assigned_to}
                              </span>
                            )}
                            {/* Status badge with icon */}
                            <span className={`task-status-badge ${statusBadge.className}`}>
                              <span className="status-icon">{statusBadge.icon}</span>
                              <span className="status-label">{statusBadge.label}</span>
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
                              className={`progress-fill ${statusBadge.className}`}
                              style={{ width: `${task.progress_percentage}%` }}
                            />
                          </div>
                          <div className="progress-info">
                            <span className="progress-text">{task.progress_percentage || 0}%</span>
                            {/* Only show auto/manual indicator for date-based tasks */}
                            {task.auto_progress_enabled && task.auto_progress !== undefined && task.start_date && task.end_date && (
                              <span className="progress-mode" title={`Auto progress: ${task.auto_progress}%`}>
                                {task.progress_percentage === task.auto_progress ? '🤖 Auto' : '✋ Manual'}
                              </span>
                            )}
                          </div>
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
