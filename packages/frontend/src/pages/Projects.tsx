import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import apiClient from '../lib/api';
import '../styles/Projects.css';

interface Project {
  id: string;
  name: string;
  location: string;
  budget: number;
  start_date: string;
  planned_end_date: string;
  actual_end_date?: string;
  status: string;
  created_at: string;
}

function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/projects');
      setProjects(response.data.data || response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProjects = filteredProjects.slice(startIndex, startIndex + itemsPerPage);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="projects-container">
          <div className="loading">Loading projects...</div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="projects-container">
          <div className="error">{error}</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="projects-container">
      <div className="projects-header">
        <h1>Projects</h1>
        <button className="btn-primary" onClick={() => navigate('/projects/new')}>
          Create Project
        </button>
      </div>

      <div className="projects-controls">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="filter-controls">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Status</option>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>

          <div className="view-toggle">
            <button
              className={viewMode === 'table' ? 'active' : ''}
              onClick={() => setViewMode('table')}
              title="Table view"
            >
              ☰
            </button>
            <button
              className={viewMode === 'card' ? 'active' : ''}
              onClick={() => setViewMode('card')}
              title="Card view"
            >
              ⊞
            </button>
          </div>
        </div>
      </div>

      {paginatedProjects.length === 0 ? (
        <div className="no-results">
          {searchTerm || statusFilter !== 'all'
            ? 'No projects match your filters'
            : 'No projects yet. Create your first project!'}
        </div>
      ) : viewMode === 'table' ? (
        <div className="projects-table-container">
          <table className="projects-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Budget</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProjects.map((project) => (
                <tr key={project.id} onClick={() => navigate(`/projects/${project.id}`)}>
                  <td className="project-name">{project.name}</td>
                  <td>{project.location}</td>
                  <td>{formatCurrency(project.budget)}</td>
                  <td>{formatDate(project.start_date)}</td>
                  <td>{formatDate(project.planned_end_date)}</td>
                  <td>
                    <span className={`status-badge status-${project.status}`}>
                      {project.status}
                    </span>
                  </td>
                  <td className="actions">
                    <button
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/projects/${project.id}`);
                      }}
                      title="View details"
                    >
                      👁
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="projects-grid">
          {paginatedProjects.map((project) => (
            <div
              key={project.id}
              className="project-card"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <div className="card-header">
                <h3>{project.name}</h3>
                <span className={`status-badge status-${project.status}`}>
                  {project.status}
                </span>
              </div>
              <div className="card-body">
                <div className="card-field">
                  <span className="label">Location:</span>
                  <span>{project.location}</span>
                </div>
                <div className="card-field">
                  <span className="label">Budget:</span>
                  <span>{formatCurrency(project.budget)}</span>
                </div>
                <div className="card-field">
                  <span className="label">Start Date:</span>
                  <span>{formatDate(project.start_date)}</span>
                </div>
                <div className="card-field">
                  <span className="label">End Date:</span>
                  <span>{formatDate(project.planned_end_date)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
      </div>
    </Layout>
  );
}

export default Projects;
