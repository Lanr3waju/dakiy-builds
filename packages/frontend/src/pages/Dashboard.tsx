import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/layout/Layout';
import Analytics from '../components/Analytics';
import apiClient from '../lib/api';
import '../styles/Dashboard.css';

interface DashboardData {
  activeProjects: number;
  totalTasks: number;
  completedTasks: number;
  tasksAtRisk: number;
  overallProgress: number;
}

interface Project {
  id: string;
  name: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch dashboard KPIs
        const dashboardResponse = await apiClient.get('/dashboard');
        setDashboardData(dashboardResponse.data.data);

        // Fetch projects list for analytics dropdown
        const projectsResponse = await apiClient.get('/projects');
        const projectsList = projectsResponse.data.data || [];
        setProjects(projectsList);
        
        // Auto-select first project if available
        if (projectsList.length > 0 && !selectedProjectId) {
          setSelectedProjectId(projectsList[0].id);
        }
      } catch (err: any) {
        console.error('Error fetching dashboard data:', err);
        setError(err.response?.data?.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <Layout>
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>Dashboard</h1>
          <p className="dashboard-subtitle">Welcome back, {user?.firstName} {user?.lastName}!</p>
        </div>
        
        <div className="dashboard-content">
          {loading ? (
            <div className="dashboard-loading">
              <p>Loading dashboard data...</p>
            </div>
          ) : error ? (
            <div className="dashboard-error">
              <p>⚠️ {error}</p>
            </div>
          ) : (
            <>
              <div className="kpi-cards">
                <div className="kpi-card">
                  <div className="kpi-icon">🏗️</div>
                  <div className="kpi-info">
                    <h3>Active Projects</h3>
                    <p className="kpi-value">{dashboardData?.activeProjects || 0}</p>
                  </div>
                </div>
                
                <div className="kpi-card">
                  <div className="kpi-icon">⚠️</div>
                  <div className="kpi-info">
                    <h3>Tasks at Risk</h3>
                    <p className="kpi-value">{dashboardData?.tasksAtRisk || 0}</p>
                  </div>
                </div>
                
                <div className="kpi-card">
                  <div className="kpi-icon">✓</div>
                  <div className="kpi-info">
                    <h3>Overall Progress</h3>
                    <p className="kpi-value">{dashboardData?.overallProgress || 0}%</p>
                  </div>
                </div>
              </div>

              {dashboardData && dashboardData.tasksAtRisk > 0 && (
                <div className="risk-alerts">
                  <div className="risk-alert high-risk">
                    <div className="risk-alert-icon">⚠️</div>
                    <div className="risk-alert-content">
                      <h3>High Risk Alert</h3>
                      <p>You have {dashboardData.tasksAtRisk} task{dashboardData.tasksAtRisk !== 1 ? 's' : ''} at risk. Review and take action to prevent delays.</p>
                    </div>
                  </div>
                </div>
              )}

              {projects.length > 0 && (
                <div className="analytics-section">
                  <div className="analytics-header">
                    <h2>Project Analytics</h2>
                    <select 
                      className="project-selector"
                      value={selectedProjectId || ''}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {selectedProjectId && <Analytics projectId={selectedProjectId} />}
                </div>
              )}

              {projects.length === 0 && (
                <div className="dashboard-placeholder">
                  <p>No projects found. Create a project to see analytics.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
