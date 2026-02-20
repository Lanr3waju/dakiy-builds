import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import apiClient from '../lib/api';
import '../styles/AuditLogs.css';

interface AuditLog {
  id: string;
  user_id: string;
  user_name?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: any;
  ip_address?: string;
  created_at: string;
}

const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/audit-logs');
      setLogs(response.data.data || response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesEntityType = entityTypeFilter === 'all' || log.entity_type === entityTypeFilter;
    
    return matchesSearch && matchesAction && matchesEntityType;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionBadgeClass = (action: string) => {
    if (action.includes('create')) return 'action-badge action-create';
    if (action.includes('update') || action.includes('edit')) return 'action-badge action-update';
    if (action.includes('delete')) return 'action-badge action-delete';
    if (action.includes('login') || action.includes('logout')) return 'action-badge action-auth';
    return 'action-badge action-other';
  };

  const toggleLogDetails = (logId: string) => {
    setExpandedLog(expandedLog === logId ? null : logId);
  };

  const uniqueActions = Array.from(new Set(logs.map(log => log.action))).sort();
  const uniqueEntityTypes = Array.from(new Set(logs.map(log => log.entity_type))).sort();

  if (loading) {
    return (
      <Layout>
        <div className="audit-logs-container">
          <div className="loading">Loading audit logs...</div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="audit-logs-container">
          <div className="error">{error}</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="audit-logs-container">
        <div className="audit-logs-header">
          <h1>Audit Logs</h1>
          <button className="btn-secondary" onClick={fetchAuditLogs}>
            Refresh
          </button>
        </div>

        <div className="audit-logs-controls">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="filter-controls">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Actions</option>
              {uniqueActions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>

            <select
              value={entityTypeFilter}
              onChange={(e) => {
                setEntityTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Entity Types</option>
              {uniqueEntityTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {paginatedLogs.length === 0 ? (
          <div className="no-results">
            {searchTerm || actionFilter !== 'all' || entityTypeFilter !== 'all'
              ? 'No logs match your filters'
              : 'No audit logs found'}
          </div>
        ) : (
          <div className="audit-logs-table-container">
            <table className="audit-logs-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity Type</th>
                  <th>Entity ID</th>
                  <th>IP Address</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log) => (
                  <>
                    <tr key={log.id}>
                      <td className="timestamp">{formatDate(log.created_at)}</td>
                      <td>{log.user_name || log.user_id}</td>
                      <td>
                        <span className={getActionBadgeClass(log.action)}>
                          {log.action}
                        </span>
                      </td>
                      <td>{log.entity_type}</td>
                      <td className="entity-id">{log.entity_id.substring(0, 8)}...</td>
                      <td>{log.ip_address || 'N/A'}</td>
                      <td>
                        <button
                          className="btn-details"
                          onClick={() => toggleLogDetails(log.id)}
                        >
                          {expandedLog === log.id ? '▼' : '▶'}
                        </button>
                      </td>
                    </tr>
                    {expandedLog === log.id && (
                      <tr className="details-row">
                        <td colSpan={7}>
                          <div className="log-details">
                            <h4>Details:</h4>
                            <pre>{JSON.stringify(log.details, null, 2)}</pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
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

        <div className="audit-logs-summary">
          <p>
            Showing {startIndex + 1} - {Math.min(startIndex + itemsPerPage, filteredLogs.length)} of {filteredLogs.length} logs
            {filteredLogs.length !== logs.length && ` (filtered from ${logs.length} total)`}
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default AuditLogs;
