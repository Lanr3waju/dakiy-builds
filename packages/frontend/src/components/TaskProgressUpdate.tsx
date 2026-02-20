import { useState, useEffect } from 'react';
import apiClient from '../lib/api';
import '../styles/TaskProgressUpdate.css';

interface ProgressHistory {
  id: string;
  task_id: string;
  progress: number;
  notes?: string;
  updated_by: string;
  updated_by_username?: string;
  created_at: string;
}

interface TaskProgressUpdateProps {
  taskId: string;
  currentProgress: number;
  onSuccess?: () => void;
}

function TaskProgressUpdate({ taskId, currentProgress, onSuccess }: TaskProgressUpdateProps) {
  const [progress, setProgress] = useState(currentProgress);
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState<ProgressHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProgress(currentProgress);
    fetchProgressHistory();
  }, [taskId, currentProgress]);

  const fetchProgressHistory = async () => {
    try {
      setHistoryLoading(true);
      const response = await apiClient.get(`/tasks/${taskId}/progress`);
      setHistory(response.data);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (progress < 0 || progress > 100) {
      setError('Progress must be between 0 and 100');
      return;
    }

    setLoading(true);

    try {
      await apiClient.post(`/tasks/${taskId}/progress`, {
        progress,
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
        <h3>Update Progress</h3>
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
                      style={{ backgroundColor: getProgressColor(entry.progress) }}
                    >
                      {entry.progress}%
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
