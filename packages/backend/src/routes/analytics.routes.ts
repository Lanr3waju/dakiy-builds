import { Router, Response } from 'express';
import { pool } from '../config/database';
import { forecastService } from '../services/forecast.service';
import {
  authenticate,
  AuthenticatedRequest,
} from '../middleware/auth.middleware';
import { ValidationError, NotFoundError } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';

const router = Router();

// All analytics routes require authentication
router.use(authenticate);

/**
 * GET /api/projects/:id/forecast
 * Generate or retrieve cached forecast for a project
 */
router.get(
  '/projects/:id/forecast',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('Project ID is required');
    }

    // Generate forecast using the forecast service
    const forecast = await forecastService.generateForecast(id, req.user!.id);

    logger.info('Forecast generated', { projectId: id, userId: req.user!.id });

    res.status(200).json({
      success: true,
      data: forecast,
    });
  })
);

/**
 * GET /api/dashboard
 * Get KPIs and aggregated data for dashboard
 */
router.get(
  '/dashboard',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    // Get user role
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    const userRole = userResult.rows[0].role;

    // Build query based on user role
    let projectFilter = '';
    const queryParams: any[] = [userId];

    if (userRole !== 'Admin') {
      projectFilter = `AND (p.owner_id = $1 OR EXISTS (
        SELECT 1 FROM project_team_members ptm 
        WHERE ptm.project_id = p.id AND ptm.user_id = $1
      ))`;
    }

    // Get active projects count
    const activeProjectsResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM projects p
       WHERE p.is_active = true ${projectFilter}`,
      userRole === 'Admin' ? [] : queryParams
    );

    // Get total tasks count
    const totalTasksResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE p.is_active = true ${projectFilter}`,
      userRole === 'Admin' ? [] : queryParams
    );

    // Get completed tasks count
    const completedTasksResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE p.is_active = true AND t.is_completed = true ${projectFilter}`,
      userRole === 'Admin' ? [] : queryParams
    );

    // Get tasks at risk (progress < 50% and estimated duration passed)
    const tasksAtRiskResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE p.is_active = true 
       AND t.is_completed = false
       AND t.progress_percentage < 50 ${projectFilter}`,
      userRole === 'Admin' ? [] : queryParams
    );

    // Calculate overall progress
    const totalTasks = parseInt(totalTasksResult.rows[0].count);
    const completedTasks = parseInt(completedTasksResult.rows[0].count);
    const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const dashboard = {
      activeProjects: parseInt(activeProjectsResult.rows[0].count),
      totalTasks,
      completedTasks,
      tasksAtRisk: parseInt(tasksAtRiskResult.rows[0].count),
      overallProgress,
    };

    logger.info('Dashboard data requested', { userId });

    res.status(200).json({
      success: true,
      data: dashboard,
    });
  })
);

/**
 * GET /api/projects/:id/timeline
 * Get timeline data for Gantt view
 */
router.get(
  '/projects/:id/timeline',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('Project ID is required');
    }

    // Verify project exists and user has access
    const projectCheck = await pool.query(
      `SELECT p.id, p.name, p.start_date, p.planned_completion_date
       FROM projects p
       LEFT JOIN project_team_members ptm ON p.id = ptm.project_id
       LEFT JOIN users u ON u.id = $2
       WHERE p.id = $1 
       AND (ptm.user_id = $2 OR p.owner_id = $2 OR u.role = 'Admin')`,
      [id, req.user!.id]
    );

    if (projectCheck.rows.length === 0) {
      throw new NotFoundError('Project not found or access denied');
    }

    // Get all tasks with their dependencies
    const tasksResult = await pool.query(
      `SELECT 
        t.id,
        t.name,
        t.phase,
        t.estimated_duration_days,
        t.progress_percentage,
        t.is_completed,
        t.assigned_to,
        u.username as assigned_to_name,
        COALESCE(
          json_agg(
            json_build_object('depends_on_task_id', td.depends_on_task_id)
          ) FILTER (WHERE td.depends_on_task_id IS NOT NULL),
          '[]'
        ) as dependencies
       FROM tasks t
       LEFT JOIN task_dependencies td ON t.id = td.task_id
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.project_id = $1
       GROUP BY t.id, t.name, t.phase, t.estimated_duration_days, 
                t.progress_percentage, t.is_completed, t.assigned_to, u.username
       ORDER BY t.phase, t.created_at`,
      [id]
    );

    const timeline = {
      project: projectCheck.rows[0],
      tasks: tasksResult.rows,
    };

    logger.info('Timeline data requested', { projectId: id, userId: req.user!.id });

    res.status(200).json({
      success: true,
      data: timeline,
    });
  })
);

/**
 * GET /api/projects/:id/analytics
 * Get progress trends and charts data
 */
router.get(
  '/projects/:id/analytics',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('Project ID is required');
    }

    // Verify project exists and user has access
    const projectCheck = await pool.query(
      `SELECT p.id, p.name
       FROM projects p
       LEFT JOIN project_team_members ptm ON p.id = ptm.project_id
       LEFT JOIN users u ON u.id = $2
       WHERE p.id = $1 
       AND (ptm.user_id = $2 OR p.owner_id = $2 OR u.role = 'Admin')`,
      [id, req.user!.id]
    );

    if (projectCheck.rows.length === 0) {
      throw new NotFoundError('Project not found or access denied');
    }

    // Get task progress by phase
    const progressByPhaseResult = await pool.query(
      `SELECT 
        phase,
        COUNT(*) as total_tasks,
        SUM(CASE WHEN is_completed THEN 1 ELSE 0 END) as completed_tasks,
        ROUND(AVG(progress_percentage), 2) as avg_progress
       FROM tasks
       WHERE project_id = $1
       GROUP BY phase
       ORDER BY phase`,
      [id]
    );

    // Get progress history over time (last 30 days)
    const progressHistoryResult = await pool.query(
      `SELECT 
        DATE(tph.created_at) as date,
        AVG(tph.progress_percentage) as avg_progress
       FROM task_progress_history tph
       JOIN tasks t ON tph.task_id = t.id
       WHERE t.project_id = $1
       AND tph.created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(tph.created_at)
       ORDER BY date`,
      [id]
    );

    // Get task completion trend
    const completionTrendResult = await pool.query(
      `SELECT 
        DATE(completed_at) as date,
        COUNT(*) as completed_count
       FROM tasks
       WHERE project_id = $1
       AND is_completed = true
       AND completed_at IS NOT NULL
       AND completed_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(completed_at)
       ORDER BY date`,
      [id]
    );

    const analytics = {
      progressByPhase: progressByPhaseResult.rows,
      progressHistory: progressHistoryResult.rows,
      completionTrend: completionTrendResult.rows,
    };

    logger.info('Analytics data requested', { projectId: id, userId: req.user!.id });

    res.status(200).json({
      success: true,
      data: analytics,
    });
  })
);

export default router;
