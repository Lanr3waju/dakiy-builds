import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import apiClient from '../lib/api';
import '../styles/Tasks.css';

interface Task {
  id: string;
  project_id: string;
  project_name: string;
  name: string;
  phase: string;
  progress_percentage: number;
  is_completed: boolean;
  assigned_to: string | null;
}

const Tasks = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'my-tasks' | 'completed'>('all');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/projects');
      const projects = response.data.data || response.data;
      
      const allTasks: Task[] = [];
      for (const project of projects) {
        try {
          const tasksResponse = await apiClient.get(`/projects/${project.id}/tasks`);
          const projectTasks = (tasksResponse.data.data || tasksResponse.data).map((task: any) => ({
            ...task,
            project_name: project.name,
          }));
          allTasks.push(...projectTasks);
        } catch (err) {
          console.error(`Failed to fetch tasks for project ${project.id}`, err);
        }
      }
      
      setTasks(allTasks);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'completed') return task.is_completed;
    if (filter === 'my-tasks') return task.assigned_to; // Would need user ID comparison
    return true;
  });

  const handleTaskClick = (task: Task) => {
    navigate(`/projects/${task.project_id}`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="tasks-container">
          <div className="loading">Loading tasks...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="tasks-container">
        <div className="tasks-header">
          <h1>All Tasks</h1>
          <div className="filter-buttons">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All Tasks
            </button>
            <button
              className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
              onClick={() => setFilter('completed')}
            >
              Completed
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="tasks-content">
          {filteredTasks.length === 0 ? (
            <div className="empty-state">
              <p>No tasks found</p>
            </div>
          ) : (
            <div className="tasks-grid">
              {filteredTasks.map(task => (
                <div
                  key={task.id}
                  className="task-card"
                  onClick={() => handleTaskClick(task)}
                >
                  <div className="task-header">
                    <h3>{task.name}</h3>
                    {task.is_completed && <span className="completed-badge">✓ Completed</span>}
                  </div>
                  <div className="task-meta">
                    <span className="project-name">{task.project_name}</span>
                    <span className="phase-badge">{task.phase}</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${task.progress_percentage}%` }}
                    />
                  </div>
                  <div className="progress-text">{task.progress_percentage}% Complete</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Tasks;
