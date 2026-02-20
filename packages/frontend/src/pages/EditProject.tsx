import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import ProjectForm from '../components/ProjectForm';
import apiClient from '../lib/api';
import '../styles/ProjectForm.css';

function EditProject() {
  const { id } = useParams<{ id: string }>();
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchProject();
    }
  }, [id]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/projects/${id}`);
      setInitialData({
        name: response.data.name,
        description: response.data.description || '',
        location: response.data.location,
        budget: response.data.budget.toString(),
        start_date: response.data.start_date.split('T')[0],
        planned_end_date: response.data.planned_end_date.split('T')[0],
        status: response.data.status,
      });
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="page-container">
          <div className="loading">Loading project...</div>
        </div>
      </Layout>
    );
  }

  if (error || !initialData) {
    return (
      <Layout>
        <div className="page-container">
          <div className="error">{error || 'Project not found'}</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container">
        <div className="page-header">
          <h1>Edit Project</h1>
        </div>
        <ProjectForm projectId={id} initialData={initialData} />
      </div>
    </Layout>
  );
}

export default EditProject;
