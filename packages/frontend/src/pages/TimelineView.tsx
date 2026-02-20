import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import Timeline from '../components/Timeline';
import apiClient from '../lib/api';
import '../styles/TimelineView.css';

interface Project {
  id: string;
  name: string;
}

const TimelineView = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/projects');
      const projectsList = response.data.data || response.data;
      setProjects(projectsList);
      
      if (projectsList.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projectsList[0].id);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="timeline-view-container">
          <div className="loading">Loading timeline...</div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="timeline-view-container">
          <div className="error-message">{error}</div>
        </div>
      </Layout>
    );
  }

  if (projects.length === 0) {
    return (
      <Layout>
        <div className="timeline-view-container">
          <div className="empty-state">
            <p>No projects found. Create a project to view its timeline.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="timeline-view-container">
        <div className="timeline-header">
          <h1>Project Timeline</h1>
          <div className="project-selector-wrapper">
            <label htmlFor="project-select">Select Project:</label>
            <select
              id="project-select"
              className="project-select"
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
        </div>

        <div className="timeline-content">
          {selectedProjectId && <Timeline projectId={selectedProjectId} />}
        </div>
      </div>
    </Layout>
  );
};

export default TimelineView;
