import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../lib/api';
import '../styles/ProjectForm.css';

interface ProjectFormData {
  name: string;
  description: string;
  location: string;
  budget: string;
  start_date: string;
  planned_end_date: string;
  status: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

interface TeamAssignment {
  user_id: string;
  role: string;
}

interface ProjectFormProps {
  projectId?: string;
  initialData?: Partial<ProjectFormData>;
  onSuccess?: () => void;
}

function ProjectForm({ projectId, initialData, onSuccess }: ProjectFormProps) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<ProjectFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    location: initialData?.location || '',
    budget: initialData?.budget || '',
    start_date: initialData?.start_date || '',
    planned_end_date: initialData?.planned_end_date || '',
    status: initialData?.status || 'planning',
  });

  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetchAvailableUsers();
    if (projectId) {
      fetchExistingTeam();
    }
  }, [projectId]);

  const fetchAvailableUsers = async () => {
    try {
      const response = await apiClient.get('/users');
      // Backend returns { success: true, data: users }
      const users = response.data.data || response.data || [];
      setAvailableUsers(Array.isArray(users) ? users : []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setAvailableUsers([]);
    }
  };

  const fetchExistingTeam = async () => {
    try {
      const response = await apiClient.get(`/projects/${projectId}/team`);
      // Backend returns { success: true, data: teamMembers }
      const teamData = response.data.data || response.data || [];
      const assignments = (Array.isArray(teamData) ? teamData : []).map((member: any) => ({
        user_id: member.userId || member.user_id,
        role: member.role,
      }));
      setTeamAssignments(assignments);
    } catch (err) {
      console.error('Failed to fetch team:', err);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    }

    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }

    if (!formData.budget || parseFloat(formData.budget) <= 0) {
      newErrors.budget = 'Budget must be a positive number';
    }

    if (!formData.start_date) {
      newErrors.start_date = 'Start date is required';
    }

    if (!formData.planned_end_date) {
      newErrors.planned_end_date = 'Planned end date is required';
    }

    if (formData.start_date && formData.planned_end_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.planned_end_date);
      if (endDate <= startDate) {
        newErrors.planned_end_date = 'End date must be after start date';
      }
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

  const handleAddTeamMember = () => {
    setTeamAssignments((prev) => [...prev, { user_id: '', role: 'Team_Member' }]);
  };

  const handleRemoveTeamMember = (index: number) => {
    setTeamAssignments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTeamAssignmentChange = (
    index: number,
    field: 'user_id' | 'role',
    value: string
  ) => {
    setTeamAssignments((prev) =>
      prev.map((assignment, i) =>
        i === index ? { ...assignment, [field]: value } : assignment
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Backend expects camelCase field names
      const projectData = {
        name: formData.name,
        description: formData.description,
        location: formData.location,
        budget: parseFloat(formData.budget),
        startDate: formData.start_date,
        plannedCompletionDate: formData.planned_end_date,
        status: formData.status,
      };

      let projectIdToUse = projectId;

      if (projectId) {
        await apiClient.put(`/projects/${projectId}`, projectData);
      } else {
        const response = await apiClient.post('/projects', projectData);
        // Backend returns { success: true, data: project }
        const project = response.data.data || response.data;
        projectIdToUse = project.id;
      }

      // Update team assignments
      if (projectIdToUse && teamAssignments.length > 0) {
        const validAssignments = teamAssignments.filter((a) => a.user_id);
        for (const assignment of validAssignments) {
          try {
            // Backend expects userId (camelCase) and role
            await apiClient.post(`/projects/${projectIdToUse}/team`, {
              userId: assignment.user_id,
              role: assignment.role,
            });
          } catch (err) {
            console.error('Failed to assign team member:', err);
          }
        }
      }

      if (onSuccess) {
        onSuccess();
      } else {
        navigate(`/projects/${projectIdToUse}`);
      }
    } catch (err: any) {
      setSubmitError(err.response?.data?.message || 'Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="project-form" onSubmit={handleSubmit}>
      <div className="form-section">
        <h2>Project Details</h2>

        <div className="form-group">
          <label htmlFor="name">
            Project Name <span className="required">*</span>
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
            rows={4}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="location">
              Location <span className="required">*</span>
            </label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              className={errors.location ? 'error' : ''}
            />
            {errors.location && <span className="error-message">{errors.location}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="budget">
              Budget <span className="required">*</span>
            </label>
            <input
              type="number"
              id="budget"
              name="budget"
              value={formData.budget}
              onChange={handleInputChange}
              min="0"
              step="0.01"
              className={errors.budget ? 'error' : ''}
            />
            {errors.budget && <span className="error-message">{errors.budget}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="start_date">
              Start Date <span className="required">*</span>
            </label>
            <input
              type="date"
              id="start_date"
              name="start_date"
              value={formData.start_date}
              onChange={handleInputChange}
              className={errors.start_date ? 'error' : ''}
            />
            {errors.start_date && <span className="error-message">{errors.start_date}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="planned_end_date">
              Planned End Date <span className="required">*</span>
            </label>
            <input
              type="date"
              id="planned_end_date"
              name="planned_end_date"
              value={formData.planned_end_date}
              onChange={handleInputChange}
              className={errors.planned_end_date ? 'error' : ''}
            />
            {errors.planned_end_date && (
              <span className="error-message">{errors.planned_end_date}</span>
            )}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" value={formData.status} onChange={handleInputChange}>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="form-section">
        <div className="section-header">
          <h2>Team Members</h2>
          <button type="button" className="btn-secondary" onClick={handleAddTeamMember}>
            + Add Member
          </button>
        </div>

        {teamAssignments.length === 0 ? (
          <p className="empty-state">No team members assigned yet</p>
        ) : (
          <div className="team-assignments">
            {teamAssignments.map((assignment, index) => (
              <div key={index} className="team-assignment-row">
                <div className="form-group flex-1">
                  <label>User</label>
                  <select
                    value={assignment.user_id}
                    onChange={(e) =>
                      handleTeamAssignmentChange(index, 'user_id', e.target.value)
                    }
                  >
                    <option value="">Select user...</option>
                    {(Array.isArray(availableUsers) ? availableUsers : []).map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.username} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group flex-1">
                  <label>Role</label>
                  <select
                    value={assignment.role}
                    onChange={(e) => handleTeamAssignmentChange(index, 'role', e.target.value)}
                  >
                    <option value="Project_Manager">Project Manager</option>
                    <option value="Team_Member">Team Member</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="btn-remove"
                  onClick={() => handleRemoveTeamMember(index)}
                  title="Remove member"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {submitError && <div className="submit-error">{submitError}</div>}

      <div className="form-actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate('/projects')}
          disabled={loading}
        >
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : projectId ? 'Update Project' : 'Create Project'}
        </button>
      </div>
    </form>
  );
}

export default ProjectForm;
