import { pool } from '../config/database';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { calendarService } from './calendar.service';
import { NotFoundError, ValidationError } from '../utils/errors';

interface Task {
  id: string;
  name: string;
  phase: string;
  estimated_duration_days: number;
  progress_percentage: number;
  is_completed: boolean;
  dependencies: string[];
}

interface ProgressHistory {
  date: Date;
  progress_percentage: number;
}

interface Forecast {
  project_id: string;
  estimated_completion_date: Date;
  risk_level: 'low' | 'medium' | 'high';
  confidence: number;
  explanation: string;
  critical_path: string[];
  total_estimated_days: number;
  cached_at: Date;
}

export class ForecastService {
  private readonly CACHE_TTL = 3600;

  async generateForecast(projectId: string, userId: string): Promise<Forecast> {
    try {
      const cached = await this.getCachedForecast(projectId);
      if (cached) {
        logger.info('Returning cached forecast', { projectId });
        return cached;
      }
    } catch (error) {
      logger.warn('Cache check failed', { error });
    }

    const projectResult = await pool.query(
      'SELECT p.id, p.name, p.location, p.start_date, p.planned_completion_date FROM projects p LEFT JOIN project_team_members ptm ON p.id = ptm.project_id LEFT JOIN users u ON u.id = $2 WHERE p.id = $1 AND (ptm.user_id = $2 OR p.owner_id = $2 OR u.role = $3)',
      [projectId, userId, 'Admin']
    );

    if (projectResult.rows.length === 0) {
      throw new NotFoundError('Project not found');
    }

    const project = projectResult.rows[0];
    const tasks = await this.getProjectTasks(projectId);

    if (tasks.length === 0) {
      throw new ValidationError('No tasks');
    }

    const criticalPath = this.calculateCriticalPath(tasks);
    const progressHistory = await this.getProgressHistory(projectId);
    const adjustedTasks = await this.adjustTaskDurations(tasks, progressHistory);

    const startDate = project.start_date || new Date();
    const { completionDate, totalDays } = await this.calculateCompletionDate(
      adjustedTasks,
      criticalPath,
      startDate,
      project.location
    );

    const riskLevel = this.assessRiskLevel(completionDate, project.planned_completion_date, tasks);
    const confidence = this.calculateConfidence(progressHistory, tasks);
    const explanation = this.generateExplanation(completionDate, project.planned_completion_date, riskLevel, confidence, criticalPath, totalDays);

    const forecast: Forecast = {
      project_id: projectId,
      estimated_completion_date: completionDate,
      risk_level: riskLevel,
      confidence,
      explanation,
      critical_path: criticalPath,
      total_estimated_days: totalDays,
      cached_at: new Date(),
    };

    await this.storeForecast(forecast);
    await this.cacheForecast(projectId, forecast);

    return forecast;
  }

  private async getProjectTasks(projectId: string): Promise<Task[]> {
    const result = await pool.query(
      'SELECT t.id, t.name, t.phase, t.estimated_duration_days, t.progress_percentage, t.is_completed, COALESCE(json_agg(td.depends_on_task_id) FILTER (WHERE td.depends_on_task_id IS NOT NULL), $2) as dependencies FROM tasks t LEFT JOIN task_dependencies td ON t.id = td.task_id WHERE t.project_id = $1 GROUP BY t.id ORDER BY t.created_at',
      [projectId, '[]']
    );

    return result.rows;
  }

  private calculateCriticalPath(tasks: Task[]): string[] {
    const inDegree = new Map<string, number>();
    const longestPath = new Map<string, number>();
    const predecessor = new Map<string, string>();

    tasks.forEach(task => {
      inDegree.set(task.id, task.dependencies.length);
      longestPath.set(task.id, 0);
    });

    const queue: string[] = [];
    tasks.forEach(task => {
      if (task.dependencies.length === 0) {
        queue.push(task.id);
        longestPath.set(task.id, task.estimated_duration_days);
      }
    });

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentPath = longestPath.get(currentId)!;

      tasks.forEach(task => {
        if (task.dependencies.includes(currentId)) {
          const newPath = currentPath + task.estimated_duration_days;
          if (newPath > (longestPath.get(task.id) || 0)) {
            longestPath.set(task.id, newPath);
            predecessor.set(task.id, currentId);
          }

          const newInDegree = (inDegree.get(task.id) || 0) - 1;
          inDegree.set(task.id, newInDegree);

          if (newInDegree === 0) {
            queue.push(task.id);
          }
        }
      });
    }

    let maxPath = 0;
    let endTask = '';
    longestPath.forEach((path, taskId) => {
      if (path > maxPath) {
        maxPath = path;
        endTask = taskId;
      }
    });

    const criticalPath: string[] = [];
    let current = endTask;
    while (current) {
      criticalPath.unshift(current);
      current = predecessor.get(current) || '';
    }

    return criticalPath;
  }

  private async getProgressHistory(projectId: string): Promise<ProgressHistory[]> {
    const result = await pool.query(
      'SELECT tph.created_at as date, tph.progress_percentage FROM task_progress_history tph JOIN tasks t ON tph.task_id = t.id WHERE t.project_id = $1 ORDER BY tph.created_at ASC',
      [projectId]
    );

    return result.rows;
  }

  private async adjustTaskDurations(tasks: Task[], progressHistory: ProgressHistory[]): Promise<Task[]> {
    let velocityFactor = 1.0;
    if (progressHistory.length > 5) {
      const recentHistory = progressHistory.slice(-10);
      const avgProgress = recentHistory.reduce((sum, h) => sum + h.progress_percentage, 0) / recentHistory.length;
      
      if (avgProgress < 30) {
        velocityFactor = 1.3;
      } else if (avgProgress < 50) {
        velocityFactor = 1.15;
      } else if (avgProgress > 80) {
        velocityFactor = 0.9;
      }
    }

    return tasks.map(task => ({
      ...task,
      estimated_duration_days: task.is_completed 
        ? 0 
        : Math.ceil(task.estimated_duration_days * velocityFactor * (1 - task.progress_percentage / 100)),
    }));
  }

  private async calculateCompletionDate(
    tasks: Task[],
    criticalPath: string[],
    startDate: Date,
    location?: string
  ): Promise<{ completionDate: Date; totalDays: number }> {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    let currentDate = new Date(startDate);
    let totalWorkingDays = 0;

    for (const taskId of criticalPath) {
      const task = taskMap.get(taskId);
      if (!task) continue;

      if (task.estimated_duration_days > 0) {
        const endDate = await calendarService.addWorkingDays(
          currentDate,
          task.estimated_duration_days,
          location
        );
        currentDate = new Date(endDate);
        totalWorkingDays += task.estimated_duration_days;
      }
    }

    return {
      completionDate: currentDate,
      totalDays: totalWorkingDays,
    };
  }

  private assessRiskLevel(
    estimatedDate: Date,
    plannedDate: Date | null,
    tasks: Task[]
  ): 'low' | 'medium' | 'high' {
    if (!plannedDate) {
      return 'medium';
    }

    const daysDifference = Math.ceil(
      (estimatedDate.getTime() - plannedDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDifference > 30) {
      return 'high';
    } else if (daysDifference > 14) {
      return 'medium';
    }

    const incompleteTasks = tasks.filter(t => !t.is_completed);
    const avgProgress = incompleteTasks.reduce((sum, t) => sum + t.progress_percentage, 0) / incompleteTasks.length;

    if (avgProgress < 30 && incompleteTasks.length > 5) {
      return 'high';
    } else if (avgProgress < 50) {
      return 'medium';
    }

    return 'low';
  }

  private calculateConfidence(progressHistory: ProgressHistory[], tasks: Task[]): number {
    let confidence = 50;

    if (progressHistory.length > 20) {
      confidence += 30;
    } else if (progressHistory.length > 10) {
      confidence += 20;
    } else if (progressHistory.length > 5) {
      confidence += 10;
    }

    const completedRatio = tasks.filter(t => t.is_completed).length / tasks.length;
    confidence += Math.round(completedRatio * 20);

    return Math.min(100, confidence);
  }

  private generateExplanation(
    estimatedDate: Date,
    plannedDate: Date | null,
    riskLevel: string,
    confidence: number,
    criticalPath: string[],
    totalDays: number
  ): string {
    const parts: string[] = [];

    parts.push(`Estimated completion: ${estimatedDate.toLocaleDateString()}.`);

    if (plannedDate) {
      const daysDiff = Math.ceil((estimatedDate.getTime() - plannedDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 0) {
        parts.push(`${daysDiff} days later than planned.`);
      } else if (daysDiff < 0) {
        parts.push(`${Math.abs(daysDiff)} days ahead of plan.`);
      } else {
        parts.push(`On schedule.`);
      }
    }

    parts.push(`Risk: ${riskLevel.toUpperCase()}.`);
    parts.push(`Critical path: ${criticalPath.length} tasks, ${totalDays} working days.`);
    parts.push(`Confidence: ${confidence}%.`);

    return parts.join(' ');
  }

  private async storeForecast(forecast: Forecast): Promise<void> {
    await pool.query(
      'INSERT INTO forecasts (project_id, estimated_completion_date, risk_level, confidence_percentage, explanation, critical_path_task_ids, created_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)',
      [
        forecast.project_id,
        forecast.estimated_completion_date,
        forecast.risk_level,
        forecast.confidence,
        forecast.explanation,
        JSON.stringify(forecast.critical_path),
      ]
    );
  }

  private async cacheForecast(projectId: string, forecast: Forecast): Promise<void> {
    try {
      const redis = getRedisClient();
      const cacheKey = `forecast:${projectId}`;
      await redis.setEx(cacheKey, this.CACHE_TTL, JSON.stringify(forecast));
    } catch (error) {
      logger.error('Failed to cache forecast', { error, projectId });
    }
  }

  private async getCachedForecast(projectId: string): Promise<Forecast | null> {
    try {
      const redis = getRedisClient();
      const cacheKey = `forecast:${projectId}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        const forecast = JSON.parse(cached);
        forecast.estimated_completion_date = new Date(forecast.estimated_completion_date);
        forecast.cached_at = new Date(forecast.cached_at);
        return forecast;
      }
    } catch (error) {
      logger.error('Failed to retrieve cached forecast', { error, projectId });
    }
    
    return null;
  }

  async invalidateForecast(projectId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const cacheKey = `forecast:${projectId}`;
      await redis.del(cacheKey);
      logger.info('Forecast cache invalidated', { projectId });
    } catch (error) {
      logger.error('Failed to invalidate forecast cache', { error, projectId });
    }
  }
}

export const forecastService = new ForecastService();
