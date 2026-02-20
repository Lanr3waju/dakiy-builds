import { useState, useRef, DragEvent } from 'react';
import apiClient from '../lib/api';
import '../styles/DocumentUpload.css';

interface DocumentUploadProps {
  projectId?: string;
  taskId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  maxFileSize?: number; // in bytes, default 50MB
}

function DocumentUpload({
  projectId,
  taskId,
  onSuccess,
  onCancel,
  maxFileSize = 50 * 1024 * 1024, // 50MB default
}: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [linkType, setLinkType] = useState<'project' | 'task' | 'none'>(
    projectId ? 'project' : taskId ? 'task' : 'none'
  );
  const [linkId, setLinkId] = useState(projectId || taskId || '');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (selectedFile: File): string | null => {
    if (selectedFile.size > maxFileSize) {
      const maxSizeMB = Math.round(maxFileSize / (1024 * 1024));
      return `File size exceeds ${maxSizeMB}MB limit`;
    }
    return null;
  };

  const handleFileSelect = (selectedFile: File) => {
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }
    setFile(selectedFile);
    setError(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    setFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (description.trim()) {
        formData.append('description', description.trim());
      }
      
      if (tags.trim()) {
        const tagArray = tags
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0);
        formData.append('tags', JSON.stringify(tagArray));
      }

      // Upload the document
      const uploadResponse = await apiClient.post('/documents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          }
        },
      });

      // Backend returns { success: true, data: document }
      const documentId = uploadResponse.data.data?.id || uploadResponse.data.id;

      // Link to project or task if specified
      if (linkType !== 'none' && linkId) {
        try {
          const linkPayload = linkType === 'project' 
            ? { projectId: linkId }
            : { taskId: linkId };
          
          await apiClient.post(`/documents/${documentId}/link`, linkPayload);
        } catch (linkErr) {
          console.error('Failed to link document:', linkErr);
          // Don't fail the upload if linking fails
        }
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload document');
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const maxSizeMB = Math.round(maxFileSize / (1024 * 1024));

  return (
    <form className="document-upload" onSubmit={handleSubmit}>
      <div className="form-section">
        <h3>Upload Document</h3>

        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={!file ? handleBrowseClick : undefined}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
            disabled={uploading}
          />

          {!file ? (
            <>
              <div className="drop-zone-icon">📁</div>
              <p className="drop-zone-text">
                Drag and drop a file here, or click to browse
              </p>
              <p className="drop-zone-hint">Maximum file size: {maxSizeMB}MB</p>
            </>
          ) : (
            <div className="selected-file">
              <div className="file-icon">📄</div>
              <div className="file-info">
                <p className="file-name">{file.name}</p>
                <p className="file-size">{formatFileSize(file.size)}</p>
              </div>
              {!uploading && (
                <button
                  type="button"
                  className="btn-remove-file"
                  onClick={handleRemoveFile}
                  title="Remove file"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        {uploading && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
            <span className="progress-text">{uploadProgress}%</span>
          </div>
        )}
      </div>

      <div className="form-section">
        <h3>Document Details</h3>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional description of the document"
            disabled={uploading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="tags">Tags</label>
          <input
            type="text"
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Enter tags separated by commas (e.g., blueprint, floor-plan, permits)"
            disabled={uploading}
          />
          <span className="field-hint">Separate multiple tags with commas</span>
        </div>
      </div>

      <div className="form-section">
        <h3>Link to Project or Task</h3>

        <div className="form-group">
          <label htmlFor="linkType">Link Type</label>
          <select
            id="linkType"
            value={linkType}
            onChange={(e) => setLinkType(e.target.value as 'project' | 'task' | 'none')}
            disabled={uploading}
          >
            <option value="none">No link</option>
            <option value="project">Link to Project</option>
            <option value="task">Link to Task</option>
          </select>
        </div>

        {linkType !== 'none' && (
          <div className="form-group">
            <label htmlFor="linkId">
              {linkType === 'project' ? 'Project ID' : 'Task ID'}
            </label>
            <input
              type="text"
              id="linkId"
              value={linkId}
              onChange={(e) => setLinkId(e.target.value)}
              placeholder={`Enter ${linkType} ID`}
              disabled={uploading}
            />
            <span className="field-hint">
              The document will be associated with this {linkType}
            </span>
          </div>
        )}
      </div>

      <div className="form-actions">
        {onCancel && (
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={uploading}
          >
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={uploading || !file}>
          {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
      </div>
    </form>
  );
}

export default DocumentUpload;
