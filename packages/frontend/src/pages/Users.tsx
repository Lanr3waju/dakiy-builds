import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import apiClient from '../lib/api';
import '../styles/Users.css';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'Admin' | 'Project_Manager' | 'Team_Member';
  createdAt: string;
  isActive?: boolean;
}

interface UserFormData {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: 'Admin' | 'Project_Manager' | 'Team_Member';
}

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    role: 'Team_Member',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/users');
      console.log('Users API response:', response.data);
      const usersData = response.data.data || response.data;
      console.log('Users data:', usersData);
      setUsers(usersData);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };


  const handleCreateUser = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      firstName: '',
      lastName: '',
      password: '',
      role: 'Team_Member',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      password: '',
      role: user.role,
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await apiClient.delete(`/users/${userId}`);
      await fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      if (editingUser) {
        const updateData: any = {
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await apiClient.put(`/users/${editingUser.id}`, updateData);
      } else {
        await apiClient.post('/users', formData);
      }
      
      setShowModal(false);
      await fetchUsers();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      console.error('Date formatting error:', error, dateString);
      return 'Invalid Date';
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'role-badge role-admin';
      case 'Project_Manager':
        return 'role-badge role-manager';
      case 'Team_Member':
        return 'role-badge role-member';
      default:
        return 'role-badge';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="users-container">
          <div className="loading">Loading users...</div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="users-container">
          <div className="error">{error}</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="users-container">
        <div className="users-header">
          <h1>User Management</h1>
          <button className="btn-primary" onClick={handleCreateUser}>
            Create User
          </button>
        </div>

        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="user-name">{user.firstName} {user.lastName}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={getRoleBadgeClass(user.role)}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td className="actions">
                    <button
                      className="btn-icon"
                      onClick={() => handleEditUser(user)}
                      title="Edit user"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-icon btn-danger"
                      onClick={() => handleDeleteUser(user.id)}
                      title="Delete user"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="no-results">
            No users found. Create your first user!
          </div>
        )}

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingUser ? 'Edit User' : 'Create User'}</h2>
                <button className="modal-close" onClick={() => setShowModal(false)}>
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="firstName">First Name *</label>
                  <input
                    type="text"
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="lastName">Last Name *</label>
                  <input
                    type="text"
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email *</label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">
                    Password {editingUser ? '(leave blank to keep current)' : '*'}
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingUser}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="role">Role *</label>
                  <select
                    id="role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    required
                  >
                    <option value="Team_Member">Team Member</option>
                    <option value="Project_Manager">Project Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                {formError && (
                  <div className="form-error">{formError}</div>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Users;
