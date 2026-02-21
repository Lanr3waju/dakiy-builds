import { useState, useEffect, useMemo } from 'react';
import { Gantt, Task as GanttTask, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import apiClient from '../lib/api';
import '../styles/Timeline.css';

interface TimelineTask {
  id: string;
  name: string;
  phase: string;
  estimated_duration_days: number;
  progress_percentage: number;
  is_completed: boolean;
  assigned_to: string | null;
  assigned_to_name: string | null;
  dependencies: Array<{ depends_on_task_id: string }>;
  start_date?: string | null;
  end_date?: string | null;
}

interface TimelineProject {
  id: string;
  name: string;
  start_date: string;
  planned_completion_date: string;
}

interface TimelineData {
  project: TimelineProject;
  tasks: TimelineTask[];
}

interface TimelineProps {
  projectId: string;
}

function Timeline({ projectId }: TimelineProps) {
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day);

  useEffect(() => {
    fetchTimelineData();
  }, [projectId]);

  const fetchTimelineData = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/projects/${projectId}/timeline`);
      // Backend returns { success: true, data: timelineData }
      const data = response.data.data || response.data;
      setTimelineData(data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load timeline data');
    } finally {
      setLoading(false);
    }
  };

  const ganttTasks = useMemo(() => {
    if (!timelineData || !timelineData.tasks || timelineData.tasks.length === 0) return [];

    const projectStartDate = timelineData.project.start_date
      ? new Date(timelineData.project.start_date)
      : new Date();

    // Create a map to track task start dates
    const taskStartDates = new Map<string, Date>();
    const taskEndDates = new Map<string, Date>();

    // Calculate start and end dates for each task based on dependencies (for legacy tasks)
    const calculateTaskDates = (task: TimelineTask, visited = new Set<string>()): Date => {
      // Prevent circular dependency infinite loops
      if (visited.has(task.id)) {
        return projectStartDate;
      }
      visited.add(task.id);

      // If already calculated, return cached value
      if (taskStartDates.has(task.id)) {
        return taskStartDates.get(task.id)!;
      }

      let startDate = new Date(projectStartDate);

      // If task has dependencies, start after the latest dependency ends
      if (task.dependencies && task.dependencies.length > 0) {
        let latestEndDate = new Date(projectStartDate);

        task.dependencies.forEach((dep) => {
          const depTask = timelineData.tasks.find((t) => t.id === dep.depends_on_task_id);
          if (depTask) {
            const depStartDate = calculateTaskDates(depTask, new Set(visited));
            const depEndDate = new Date(depStartDate);
            depEndDate.setDate(depEndDate.getDate() + depTask.estimated_duration_days);

            if (depEndDate > latestEndDate) {
              latestEndDate = depEndDate;
            }
          }
        });

        startDate = latestEndDate;
      }

      taskStartDates.set(task.id, startDate);
      return startDate;
    };

    // Calculate dates for all tasks
    timelineData.tasks.forEach((task) => {
      // Use actual dates if available (date-based tasks)
      if (task.start_date && task.end_date) {
        taskStartDates.set(task.id, new Date(task.start_date));
        taskEndDates.set(task.id, new Date(task.end_date));
      } else {
        // Legacy task: calculate dates from duration and dependencies for backward compatibility
        const startDate = calculateTaskDates(task);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + task.estimated_duration_days);
        taskEndDates.set(task.id, endDate);
      }
    });

    // Convert to Gantt task format
    const tasks: GanttTask[] = timelineData.tasks.map((task) => {
      const startDate = taskStartDates.get(task.id) || projectStartDate;
      const endDate = taskEndDates.get(task.id) || new Date(startDate);

      // Check if task is delayed (comparing with planned completion)
      const now = new Date();
      const isDelayed =
        !task.is_completed &&
        endDate < now &&
        task.progress_percentage < 100;

      return {
        id: task.id,
        name: task.name,
        start: startDate,
        end: endDate,
        progress: task.progress_percentage,
        type: 'task' as const,
        dependencies: task.dependencies.map((dep) => dep.depends_on_task_id),
        styles: isDelayed
          ? {
              progressColor: '#dc3545',
              progressSelectedColor: '#c82333',
              backgroundColor: '#f8d7da',
              backgroundSelectedColor: '#f5c2c7',
            }
          : task.is_completed
          ? {
              progressColor: '#28a745',
              progressSelectedColor: '#218838',
              backgroundColor: '#d4edda',
              backgroundSelectedColor: '#c3e6cb',
            }
          : undefined,
        project: task.phase,
        isDisabled: false,
      };
    });

    return tasks;
  }, [timelineData]);

  const handleTaskChange = (task: GanttTask) => {
    // This would be called if we allow drag-and-drop editing
    // For now, we'll keep it read-only
    console.log('Task changed:', task);
  };

  const handleTaskDelete = (task: GanttTask) => {
    // Handle task deletion if needed
    console.log('Task delete:', task);
  };

  const handleProgressChange = (task: GanttTask) => {
    // Handle progress change if needed
    console.log('Progress changed:', task);
  };

  const handleExpanderClick = (task: GanttTask) => {
    // Handle expand/collapse if we have project groups
    console.log('Expander clicked:', task);
  };

  if (loading) {
    return (
      <div className="timeline-container">
        <div className="timeline-loading">Loading timeline...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="timeline-container">
        <div className="timeline-error">{error}</div>
      </div>
    );
  }

  if (!timelineData || ganttTasks.length === 0) {
    return (
      <div className="timeline-container">
        <div className="timeline-empty">
          <p>No tasks to display in timeline view</p>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <h2>Project Timeline</h2>
        <div className="timeline-controls">
          <button
            className={`view-mode-btn ${viewMode === ViewMode.Hour ? 'active' : ''}`}
            onClick={() => setViewMode(ViewMode.Hour)}
          >
            Hour
          </button>
          <button
            className={`view-mode-btn ${viewMode === ViewMode.Day ? 'active' : ''}`}
            onClick={() => setViewMode(ViewMode.Day)}
          >
            Day
          </button>
          <button
            className={`view-mode-btn ${viewMode === ViewMode.Week ? 'active' : ''}`}
            onClick={() => setViewMode(ViewMode.Week)}
          >
            Week
          </button>
          <button
            className={`view-mode-btn ${viewMode === ViewMode.Month ? 'active' : ''}`}
            onClick={() => setViewMode(ViewMode.Month)}
          >
            Month
          </button>
        </div>
      </div>

      <div className="timeline-legend">
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#d4edda' }}></span>
          <span>Completed</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#cfe2ff' }}></span>
          <span>In Progress</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#f8d7da' }}></span>
          <span>Delayed</span>
        </div>
      </div>

      <div className="timeline-gantt">
        <Gantt
          tasks={ganttTasks}
          viewMode={viewMode}
          onDateChange={handleTaskChange}
          onDelete={handleTaskDelete}
          onProgressChange={handleProgressChange}
          onExpanderClick={handleExpanderClick}
          listCellWidth=""
          columnWidth={viewMode === ViewMode.Month ? 300 : viewMode === ViewMode.Week ? 250 : 65}
          ganttHeight={400}
          barBackgroundColor="#cfe2ff"
          barProgressColor="#0d6efd"
          barBackgroundSelectedColor="#a6c8ff"
          barProgressSelectedColor="#0a58ca"
          arrowColor="#6c757d"
          arrowIndent={20}
          todayColor="rgba(252, 248, 227, 0.5)"
          TooltipContent={({ task }) => {
            const timelineTask = timelineData.tasks.find((t) => t.id === task.id);
            return (
              <div className="gantt-tooltip">
                <div className="tooltip-title">{task.name}</div>
                <div className="tooltip-info">
                  <div>Phase: {task.project}</div>
                  <div>Progress: {task.progress || 0}%</div>
                  <div>
                    Duration: {Math.ceil((task.end.getTime() - task.start.getTime()) / (1000 * 60 * 60 * 24))} days
                  </div>
                  {timelineTask?.assigned_to_name && (
                    <div>Assigned to: {timelineTask.assigned_to_name}</div>
                  )}
                  {task.dependencies && task.dependencies.length > 0 && (
                    <div>Dependencies: {task.dependencies.length}</div>
                  )}
                </div>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}

export default Timeline;
