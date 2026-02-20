import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/layout/Layout';
import apiClient from '../lib/api';
import TaskList from '../components/TaskList';
import TaskForm from '../components/TaskForm';
import TaskProgressUpdate from '../components/TaskProgressUpdate';
import Timeline from '../components/Timeline';
import '../styles/ProjectDetail.css';

interface TeamMember {
  user_id: string;
  username: string;
  email: string;
  role: string;
}

interface Forecast {
  project_id: string;
  estimated_completion_date: string;
  risk_level: 'low' | 'medium' | 'high';
  confidence: number;
  explanation: string;
  critical_path: string[];
  total_estimated_days: number;
  cached_at: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  location: string;
  budget: number;
  start_date: string;
  planned_end_date: string;
  actual_end_date?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

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

function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showProgressUpdate, setShowProgressUpdate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  useEffect(() => {
    if (id) {
      fetchProjectDetails();
      fetchTeamMembers();
      fetchForecast();
    }
  }, [id]);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/projects/${id}`);
      setProject(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const response = await apiClient.get(`/projects/${id}/team`);
      setTeamMembers(response.data);
    } catch (err: any) {
      console.error('Failed to load team members:', err);
    }
  };

  const fetchForecast = async () => {
    try {
      setForecastLoading(true);
      const response = await apiClient.get(`/projects/${id}/forecast`);
      // Backend returns { success: true, data: forecast }
      setForecast(response.data.data || response.data);
    } catch (err: any) {
      console.error('Failed to load forecast:', err);
      // Don't show error to user - forecast is optional
    } finally {
      setForecastLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      await apiClient.delete(`/projects/${id}`);
      navigate('/projects');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete project');
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowTaskForm(true);
    setShowProgressUpdate(false);
  };

  const handleTaskFormSuccess = () => {
    setShowTaskForm(false);
    setEditingTask(null);
    setTaskRefreshKey((prev) => prev + 1);
    fetchForecast();
  };

  const handleTaskFormCancel = () => {
    setShowTaskForm(false);
    setEditingTask(null);
  };

  const handleUpdateProgress = (task: Task) => {
    setSelectedTask(task);
    setShowProgressUpdate(true);
    setShowTaskForm(false);
  };

  const handleProgressUpdateSuccess = () => {
    setShowProgressUpdate(false);
    setSelectedTask(null);
    setTaskRefreshKey((prev) => prev + 1);
    fetchForecast();
  };

  const handleNewTask = () => {
    setEditingTask(null);
    setShowTaskForm(true);
    setShowProgressUpdate(false);
  };

  const canEdit = user?.role === 'Admin' || user?.role === 'Project_Manager';
  const canDelete = user?.role === 'Admin' || user?.role === 'Project_Manager';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return '#28a745';
      case 'medium':
        return '#ffc107';
      case 'high':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="project-detail-container">
          <div className="loading">Loading project details...</div>
        </div>
      </Layout>
    );
  }

  if (error || !project) {
    return (
      <Layout>
        <div className="project-detail-container">
          <div className="error">{error || 'Project not found'}</div>
          <button className="btn-secondary" onClick={() => navigate('/projects')}>
            Back to Projects
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="project-detail-container">
      <div className="detail-header">
        <button className="btn-back" onClick={() => navigate('/projects')}>
          ← Back
        </button>
        <div className="header-actions">
          {canEdit && (
            <button
              className="btn-secondary"
              onClick={() => navigate(`/projects/${id}/edit`)}
            >
              Edit Project
            </button>
          )}
          {canDelete && (
            <button className="btn-danger" onClick={handleDelete}>
              Delete Project
            </button>
          )}
        </div>
      </div>

      <div className="project-header">
        <div>
          <h1>{project.name}</h1>
          <span className={`status-badge status-${project.status}`}>
            {project.status}
          </span>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-section metadata-section">
          <h2>Project Information</h2>
          <div className="metadata-grid">
            <div className="metadata-item">
              <span className="label">Location</span>
              <span className="value">{project.location}</span>
            </div>
            <div className="metadata-item">
              <span className="label">Budget</span>
              <span className="value">{formatCurrency(project.budget)}</span>
            </div>
            <div className="metadata-item">
              <span className="label">Start Date</span>
              <span className="value">{formatDate(project.start_date)}</span>
            </div>
            <div className="metadata-item">
              <span className="label">Planned End Date</span>
              <span className="value">{formatDate(project.planned_end_date)}</span>
            </div>
            {project.actual_end_date && (
              <div className="metadata-item">
                <span className="label">Actual End Date</span>
                <span className="value">{formatDate(project.actual_end_date)}</span>
              </div>
            )}
            {project.description && (
              <div className="metadata-item full-width">
                <span className="label">Description</span>
                <span className="value">{project.description}</span>
              </div>
            )}
          </div>
        </div>

        <div className="detail-section team-section">
          <h2>Team Members</h2>
          {teamMembers.length === 0 ? (
            <p className="empty-state">No team members assigned yet</p>
          ) : (
            <div className="team-list">
              {teamMembers.map((member) => (
                <div key={member.user_id} className="team-member">
                  <div className="member-info">
                    <div className="member-name">{member.username}</div>
                    <div className="member-email">{member.email}</div>
                  </div>
                  <span className="member-role">{member.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="detail-section forecast-section">
          <h2>Project Forecast</h2>
          {forecastLoading ? (
            <div className="forecast-loading">Loading forecast...</div>
          ) : forecast ? (
            <div className="forecast-content">
              <div className="forecast-header">
                <div className="forecast-date">
                  <span className="label">Estimated Completion</span>
                  <span className="value">{formatDate(forecast.estimated_completion_date)}</span>
                </div>
                <div
                  className="risk-indicator"
                  style={{ backgroundColor: getRiskColor(forecast.risk_level) }}
                >
                  <span className="risk-label">Risk Level</span>
                  <span className="risk-value">{forecast.risk_level.toUpperCase()}</span>
                </div>
              </div>
              {forecast.confidence !== undefined && (
                <div className="confidence-score">
                  <span className="label">Confidence Score</span>
                  <div className="confidence-bar">
                    <div
                      className="confidence-fill"
                      style={{ width: `${forecast.confidence}%` }}
                    />
                  </div>
                  <span className="confidence-value">
                    {forecast.confidence.toFixed(0)}%
                  </span>
                </div>
              )}
              <div className="forecast-explanation">
                <span className="label">Analysis</span>
                <p>{forecast.explanation}</p>
              </div>
              <button className="btn-secondary" onClick={fetchForecast}>
                Refresh Forecast
              </button>
            </div>
          ) : (
            <div className="forecast-empty">
              <p>No forecast available yet</p>
              <button className="btn-primary" onClick={fetchForecast}>
                Generate Forecast
              </button>
            </div>
          )}
        </div>

        <div className="detail-section tasks-section">
          <div className="section-header">
            <h2>Tasks</h2>
            <div className="section-actions">
              <div className="view-toggle">
                <button
                  className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  List View
                </button>
                <button
                  className={`toggle-btn ${viewMode === 'timeline' ? 'active' : ''}`}
                  onClick={() => setViewMode('timeline')}
                >
                  Timeline View
                </button>
              </div>
              {canEdit && !showTaskForm && viewMode === 'list' && (
                <button className="btn-primary" onClick={handleNewTask}>
                  + New Task
                </button>
              )}
            </div>
          </div>

          {showTaskForm && (
            <div className="task-form-container">
              <TaskForm
                projectId={id!}
                taskId={editingTask?.id}
                initialData={editingTask || undefined}
                onSuccess={handleTaskFormSuccess}
                onCancel={handleTaskFormCancel}
              />
            </div>
          )}

          {showProgressUpdate && selectedTask && (
            <div className="progress-update-container">
              <div className="progress-update-header">
                <h3>Update Progress: {selectedTask.name}</h3>
                <button
                  className="btn-secondary"
                  onClick={() => setShowProgressUpdate(false)}
                >
                  Close
                </button>
              </div>
              <TaskProgressUpdate
                taskId={selectedTask.id}
                currentProgress={selectedTask.progress}
                onSuccess={handleProgressUpdateSuccess}
              />
            </div>
          )}

          {!showTaskForm && !showProgressUpdate && viewMode === 'list' && (
            <TaskList
              key={taskRefreshKey}
              projectId={id!}
              onEditTask={handleEditTask}
              onUpdateProgress={handleUpdateProgress}
              onDeleteTask={() => {
                setTaskRefreshKey((prev) => prev + 1);
                fetchForecast();
              }}
              onRefresh={() => setTaskRefreshKey((prev) => prev + 1)}
            />
          )}

          {!showTaskForm && !showProgressUpdate && viewMode === 'timeline' && (
            <Timeline projectId={id!} />
          )}
        </div>
      </div>
      </div>
    </Layout>
  );
}

export default ProjectDetail;
