import { useState, useEffect } from 'react';
import apiClient from '../lib/api';
import '../styles/TaskProgressUpdate.css';

interface ProgressHistory {
  id: string;
  task_id: string;
  progress_percentage: number;  // Changed from 'progress' to 'progress_percentage'
  notes?: string;
  updated_by: string;
  updated_by_username?: string;
  created_at: string;
}


interface TaskProgressUpdateProps {
  taskId: string;
  currentProgress: number;
  autoProgressEnabled?: boolean;
  autoProgress?: number;
  startDate?: string | null;
  endDate?: string | null;
  onSuccess?: () => void;
}

function TaskProgressUpdate({ 
  taskId, 
  currentProgress, 
  autoProgressEnabled,
  autoProgress,
  startDate,
  endDate,
  onSuccess 
}: TaskProgressUpdateProps) {
  const [progress, setProgress] = useState(currentProgress);
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState<ProgressHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Only enable auto mode if dates are present AND autoProgressEnabled is true
  const hasDateTracking = !!(startDate && endDate);
  const [isAutoMode, setIsAutoMode] = useState(
    hasDateTracking && (autoProgressEnabled ?? false)
  );
  const [calculatedAutoProgress, setCalculatedAutoProgress] = useState(autoProgress || 0);

  useEffect(() => {
    setProgress(currentProgress);
    const hasDateTracking = !!(startDate && endDate);
    setIsAutoMode(hasDateTracking && (autoProgressEnabled ?? false));
    setCalculatedAutoProgress(autoProgress || 0);
    fetchProgressHistory();
  }, [taskId, currentProgress, autoProgressEnabled, autoProgress, startDate, endDate]);

  const fetchProgressHistory = async () => {
    try {
      setHistoryLoading(true);
      const response = await apiClient.get(`/tasks/${taskId}/progress`);
      setHistory(response.data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch progress history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setProgress(value);
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
  };

  const handleModeToggle = async () => {
    const newMode = !isAutoMode;
    setIsAutoMode(newMode);
    setError(null);

    // Update the task's autoProgressEnabled flag
    try {
      await apiClient.put(`/tasks/${taskId}`, {
        autoProgressEnabled: newMode,
      });

      // If switching to auto mode, update progress to auto-calculated value
      if (newMode && calculatedAutoProgress !== undefined) {
        setProgress(calculatedAutoProgress);
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update progress mode');
      // Revert the toggle on error
      setIsAutoMode(!newMode);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (progress < 0 || progress > 100) {
      setError('Progress must be between 0 and 100');
      return;
    }

    // In auto mode, don't allow manual progress updates
    if (isAutoMode) {
      setError('Cannot manually update progress in automatic mode. Switch to manual mode first.');
      return;
    }

    setLoading(true);

    try {
      await apiClient.post(`/tasks/${taskId}/progress`, {
        progressPercentage: progress,
        notes: notes.trim() || undefined,
      });

      setNotes('');
      await fetchProgressHistory();

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update progress');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getProgressColor = (progress: number) => {
    if (progress === 100) return '#28a745';
    if (progress >= 75) return '#17a2b8';
    if (progress >= 50) return '#ffc107';
    if (progress >= 25) return '#fd7e14';
    return '#dc3545';
  };

  return (
    <div className="task-progress-update">
      <div className="progress-form-section">
        <div className="progress-header">
          <h3>Update Progress</h3>
          <div className="progress-mode-badge" data-mode={isAutoMode ? 'auto' : 'manual'}>
            {isAutoMode ? '🤖 Auto' : '✋ Manual'}
          </div>
        </div>

        {/* Progress Mode Toggle - Only show if dates are available */}
        {hasDateTracking && (
          <div className="progress-mode-toggle">
            <label className="toggle-label">
              <span className="toggle-text">
                {isAutoMode ? 'Automatic Progress (based on dates)' : 'Manual Progress Updates'}
              </span>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={isAutoMode}
                  onChange={handleModeToggle}
                />
                <span className="toggle-slider"></span>
              </div>
            </label>
          </div>
        )}

        {/* Show message for legacy tasks without date tracking */}
        {!hasDateTracking && (
          <div className="progress-mode-info">
            <p className="info-message">
              ℹ️ This task uses manual progress tracking. Set start and end dates to enable automatic progress tracking.
            </p>
          </div>
        )}

        {/* Auto Progress Display (Read-only) */}
        {isAutoMode && hasDateTracking && (
          <div className="auto-progress-display">
            <div className="auto-progress-info">
              <span className="info-icon">ℹ️</span>
              <div className="info-text">
                <strong>Automatic Progress: {calculatedAutoProgress}%</strong>
                <p>Progress is calculated based on elapsed time between start and end dates.</p>
              </div>
            </div>
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill" 
                style={{ 
                  width: `${calculatedAutoProgress}%`,
                  backgroundColor: getProgressColor(calculatedAutoProgress)
                }}
              >
                <span className="progress-bar-text">{calculatedAutoProgress}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Manual Progress Form */}
        {!isAutoMode && (
          <form onSubmit={handleSubmit}>
            <div className="progress-input-group">
              <div className="progress-slider-container">
                <label htmlFor="progress-slider">Progress: {progress}%</label>
                <input
                  type="range"
                  id="progress-slider"
                  min="0"
                  max="100"
                  step="1"
                  value={progress}
                  onChange={handleProgressChange}
                  className="progress-slider"
                  style={{
                    background: `linear-gradient(to right, ${getProgressColor(progress)} 0%, ${getProgressColor(progress)} ${progress}%, #e9ecef ${progress}%, #e9ecef 100%)`,
                  }}
                />
                <div className="progress-markers">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="progress-number-input">
                <label htmlFor="progress-number">Or enter value:</label>
                <input
                  type="number"
                  id="progress-number"
                  min="0"
                  max="100"
                  step="1"
                  value={progress}
                  onChange={handleProgressChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes (optional)</label>
              <textarea
                id="notes"
                value={notes}
                onChange={handleNotesChange}
                rows={3}
                placeholder="Add any notes about this progress update..."
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Updating...' : 'Update Progress'}
            </button>
          </form>
        )}
      </div>

      <div className="progress-history-section">
        <h3>Progress History</h3>
        {historyLoading ? (
          <div className="history-loading">Loading history...</div>
        ) : history.length === 0 ? (
          <div className="history-empty">No progress updates yet</div>
        ) : (
          <div className="history-list">
            {history.map((entry) => (
              <div key={entry.id} className="history-item">
                <div className="history-header">
                  <div className="history-progress">
                    <div
                      className="progress-badge"
                      style={{ backgroundColor: getProgressColor(entry.progress_percentage) }}
                    >
                      {entry.progress_percentage}%
                    </div>
                  </div>
                  <div className="history-meta">
                    <span className="history-user">
                      {entry.updated_by_username || 'Unknown User'}
                    </span>
                    <span className="history-date">{formatDate(entry.created_at)}</span>
                  </div>
                </div>
                {entry.notes && (
                  <div className="history-notes">
                    <p>{entry.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TaskProgressUpdate;
