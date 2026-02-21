import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import apiClient from '../lib/api';
import '../styles/Analytics.css';

interface ProgressByPhase {
  phase: string;
  total_tasks: number;
  completed_tasks: number;
  avg_progress: number;
}

interface ProgressHistory {
  date: string;
  avg_progress: number;
}

interface CompletionTrend {
  date: string;
  completed_count: number;
}

interface AnalyticsData {
  progressByPhase: ProgressByPhase[];
  progressHistory: ProgressHistory[];
  completionTrend: CompletionTrend[];
}

interface AnalyticsProps {
  projectId: string;
}

const Analytics: React.FC<AnalyticsProps> = ({ projectId }) => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.get(`/projects/${projectId}/analytics`);
        setAnalyticsData(response.data.data);
      } catch (err: any) {
        console.error('Error fetching analytics:', err);
        setError(err.response?.data?.message || 'Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchAnalytics();
    }
  }, [projectId]);

  if (loading) {
    return (
      <div className="analytics-container">
        <div className="analytics-loading">
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-container">
        <div className="analytics-error">
          <p>⚠️ {error}</p>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="analytics-container">
      <h2>Project Analytics</h2>

      <div className="analytics-grid">
        {/* Progress by Phase */}
        <div className="analytics-card">
          <h3>Progress by Phase</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.progressByPhase}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="phase" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="avg_progress" fill="#667eea" name="Average Progress %" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Progress Trend */}
        {analyticsData.progressHistory.length > 0 && (
          <div className="analytics-card">
            <h3>Progress Trend (Last 30 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.progressHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  labelFormatter={formatDate}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Progress']}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="avg_progress" 
                  stroke="#667eea" 
                  strokeWidth={2}
                  name="Average Progress %"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Completion Trend */}
        {analyticsData.completionTrend.length > 0 && (
          <div className="analytics-card">
            <h3>Task Completion Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.completionTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={formatDate}
                  formatter={(value: number) => [value, 'Tasks Completed']}
                />
                <Legend />
                <Bar 
                  dataKey="completed_count" 
                  fill="#48bb78" 
                  name="Tasks Completed"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Delay Indicators */}
        <div className="analytics-card delay-indicators">
          <h3>Phase Status</h3>
          <div className="phase-status-list">
            {analyticsData.progressByPhase.map((phase) => {
              const completionRate = phase.total_tasks > 0 
                ? (phase.completed_tasks / phase.total_tasks) * 100 
                : 0;
              const isDelayed = phase.avg_progress < 50 && completionRate < 50;
              
              return (
                <div key={phase.phase} className="phase-status-item">
                  <div className="phase-status-header">
                    <span className="phase-name">{phase.phase}</span>
                    {isDelayed && <span className="delay-badge">⚠️ At Risk</span>}
                  </div>
                  <div className="phase-status-details">
                    <span>{phase.completed_tasks} / {phase.total_tasks} tasks completed</span>
                    <span className="phase-progress">{phase.avg_progress.toFixed(1)}% avg progress</span>
                  </div>
                  <div className="phase-progress-bar">
                    <div 
                      className="phase-progress-fill"
                      style={{ 
                        width: `${phase.avg_progress}%`,
                        backgroundColor: isDelayed ? '#f56565' : '#48bb78'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
