import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../lib/api';
import '../styles/DocumentList.css';

interface Document {
  id: string;
  filename: string;
  description?: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  uploaded_at: string;
  tags?: string[];
  version: number;
  linked_to_type?: string;
  linked_to_id?: string;
}

interface DocumentVersion {
  id: string;
  version: number;
  uploaded_by: string;
  uploaded_at: string;
  file_size: number;
}

interface DocumentListProps {
  projectId?: string;
  taskId?: string;
  onUpload?: () => void;
}

function DocumentList({ projectId, taskId, onUpload }: DocumentListProps) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [versions, setVersions] = useState<Record<string, DocumentVersion[]>>({});

  useEffect(() => {
    fetchDocuments();
  }, [projectId, taskId]);

  useEffect(() => {
    filterDocuments();
  }, [documents, searchQuery, selectedTags]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      let url = '/documents';
      const params: string[] = [];
      
      if (projectId) {
        params.push(`project_id=${projectId}`);
      }
      if (taskId) {
        params.push(`task_id=${taskId}`);
      }
      
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }

      const response = await apiClient.get(url);
      // Backend returns { success: true, data: documents, count: ... }
      const documentsList = response.data.data || response.data || [];
      setDocuments(Array.isArray(documentsList) ? documentsList : []);
      
      // Extract unique tags
      const tags = new Set<string>();
      if (Array.isArray(documentsList)) {
        documentsList.forEach((doc: Document) => {
          if (doc.tags) {
            doc.tags.forEach((tag) => tags.add(tag));
          }
        });
      }
      setAllTags(Array.from(tags).sort());
      
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const filterDocuments = () => {
    let filtered = [...documents];

    // Filter by search query (filename or description)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (doc) =>
          doc.filename.toLowerCase().includes(query) ||
          doc.description?.toLowerCase().includes(query)
      );
    }

    // Filter by selected tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter((doc) =>
        selectedTags.every((tag) => doc.tags?.includes(tag))
      );
    }

    setFilteredDocuments(filtered);
  };

  const handleDownload = async (documentId: string) => {
    try {
      // Backend returns { success: true, data: { downloadUrl: string } }
      const response = await apiClient.get(`/documents/${documentId}/download`);
      const downloadUrl = response.data.data?.downloadUrl || response.data.downloadUrl;
      
      if (downloadUrl) {
        // Open the download URL in a new window
        window.open(downloadUrl, '_blank');
      } else {
        alert('Failed to get download URL');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to download document');
    }
  };

  const handleDelete = async (documentId: string, filename: string) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    try {
      await apiClient.delete(`/documents/${documentId}`);
      await fetchDocuments();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete document');
    }
  };

  const toggleVersionHistory = async (documentId: string) => {
    setExpandedVersions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(documentId)) {
        newSet.delete(documentId);
      } else {
        newSet.add(documentId);
        // Fetch versions if not already loaded
        if (!versions[documentId]) {
          fetchVersions(documentId);
        }
      }
      return newSet;
    });
  };

  const fetchVersions = async (documentId: string) => {
    try {
      const response = await apiClient.get(`/documents/${documentId}/versions`);
      // Backend returns { success: true, data: versions, count: ... }
      const versionsList = response.data.data || response.data || [];
      setVersions((prev) => ({ ...prev, [documentId]: Array.isArray(versionsList) ? versionsList : [] }));
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    }
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const canDelete = user?.role === 'Admin' || user?.role === 'Project_Manager';

  if (loading) {
    return <div className="document-list-loading">Loading documents...</div>;
  }

  if (error) {
    return <div className="document-list-error">{error}</div>;
  }

  return (
    <div className="document-list">
      <div className="document-list-header">
        <div className="search-section">
          <input
            type="text"
            className="search-input"
            placeholder="Search by filename or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {allTags.length > 0 && (
          <div className="tags-filter">
            <span className="filter-label">Filter by tags:</span>
            <div className="tag-buttons">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  className={`tag-button ${selectedTags.includes(tag) ? 'active' : ''}`}
                  onClick={() => handleTagToggle(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {onUpload && (
          <button className="btn-upload" onClick={onUpload}>
            + Upload Document
          </button>
        )}
      </div>

      {filteredDocuments.length === 0 ? (
        <div className="document-list-empty">
          <p>
            {documents.length === 0
              ? 'No documents uploaded yet'
              : 'No documents match your search criteria'}
          </p>
        </div>
      ) : (
        <div className="documents-grid">
          {filteredDocuments.map((doc) => {
            const isExpanded = expandedVersions.has(doc.id);
            const docVersions = versions[doc.id] || [];

            return (
              <div key={doc.id} className="document-card">
                <div className="document-header">
                  <div className="document-icon">📄</div>
                  <div className="document-info">
                    <h4 className="document-filename">{doc.filename}</h4>
                    {doc.description && (
                      <p className="document-description">{doc.description}</p>
                    )}
                  </div>
                </div>

                <div className="document-metadata">
                  <div className="metadata-row">
                    <span className="metadata-label">Size:</span>
                    <span className="metadata-value">{formatFileSize(doc.file_size)}</span>
                  </div>
                  <div className="metadata-row">
                    <span className="metadata-label">Type:</span>
                    <span className="metadata-value">{doc.mime_type}</span>
                  </div>
                  <div className="metadata-row">
                    <span className="metadata-label">Version:</span>
                    <span className="metadata-value">v{doc.version}</span>
                  </div>
                  <div className="metadata-row">
                    <span className="metadata-label">Uploaded:</span>
                    <span className="metadata-value">{formatDate(doc.uploaded_at)}</span>
                  </div>
                  <div className="metadata-row">
                    <span className="metadata-label">By:</span>
                    <span className="metadata-value">{doc.uploaded_by}</span>
                  </div>
                </div>

                {doc.tags && doc.tags.length > 0 && (
                  <div className="document-tags">
                    {doc.tags.map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="document-actions">
                  <button
                    className="btn-action btn-download"
                    onClick={() => handleDownload(doc.id)}
                    title="Download"
                  >
                    ⬇️ Download
                  </button>
                  <button
                    className="btn-action btn-versions"
                    onClick={() => toggleVersionHistory(doc.id)}
                    title="Version history"
                  >
                    📋 Versions
                  </button>
                  {canDelete && (
                    <button
                      className="btn-action btn-delete"
                      onClick={() => handleDelete(doc.id, doc.filename)}
                      title="Delete"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="version-history">
                    <h5>Version History</h5>
                    {docVersions.length === 0 ? (
                      <p className="no-versions">Loading versions...</p>
                    ) : (
                      <div className="versions-list">
                        {docVersions.map((version) => (
                          <div key={version.id} className="version-item">
                            <span className="version-number">v{version.version}</span>
                            <span className="version-date">
                              {formatDate(version.uploaded_at)}
                            </span>
                            <span className="version-user">{version.uploaded_by}</span>
                            <span className="version-size">
                              {formatFileSize(version.file_size)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DocumentList;
