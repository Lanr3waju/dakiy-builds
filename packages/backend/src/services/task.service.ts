import { pool } from '../config/database';
import { logger } from '../utils/logger';
import {
  ValidationError,
  NotFoundError,
  AuthorizationError,
} from '../utils/errors';
import { PoolClient } from 'pg';
import { forecastService } from './forecast.service';

// Types
export interface Task {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  phase: string;
  estimated_duration_days: number;
  actual_duration_days: number | null;
  progress_percentage: number;
  is_completed: boolean;
  completed_at: Date | null;
  assigned_to: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  start_date?: Date | null;
  end_date?: Date | null;
  auto_progress_enabled?: boolean;
}

export type TaskStatus = 'not_started' | 'in_progress' | 'overdue' | 'completed';

// Date Calculation Functions

/**
 * Calculate automatic progress based on elapsed time between start and end dates
 * @param task - The task object with date fields
 * @returns Progress percentage (0-100)
 */
export function calculateAutoProgress(task: Task): number {
  // If task is completed, return 100
  if (task.is_completed) {
    return 100;
  }

  // If no dates are set, return current progress
  if (!task.start_date || !task.end_date) {
    return task.progress_percentage;
  }

  const now = new Date();
  const start = new Date(task.start_date);
  const end = new Date(task.end_date);

  // If before start date, return 0
  if (now < start) {
    return 0;
  }

  // If after end date, return 100
  if (now > end) {
    return 100;
  }

  // Calculate progress based on elapsed time
  const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const elapsedDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

  return Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
}

/**
 * Determine the current status of a task based on dates and completion
 * @param task - The task object with date fields
 * @returns Task status
 */
export function determineTaskStatus(task: Task): TaskStatus {
  // If completed, return completed status
  if (task.is_completed) {
    return 'completed';
  }

  // If no dates, we can't determine status from dates (legacy duration-based task)
  // Return 'in_progress' as a safe default for backward compatibility
  if (!task.start_date || !task.end_date) {
    return 'in_progress';
  }

  const now = new Date();
  const start = new Date(task.start_date);
  const end = new Date(task.end_date);

  // If before start date, not started
  if (now < start) {
    return 'not_started';
  }

  // If after end date, overdue
  if (now > end) {
    return 'overdue';
  }

  // Otherwise, in progress
  return 'in_progress';
}

/**
 * Calculate days remaining until task end date
 * @param task - The task object with date fields
 * @returns Number of days remaining (negative if overdue), or null if no end date
 */
export function calculateDaysRemaining(task: Task): number | null {
  // If completed, return 0
  if (task.is_completed) {
    return 0;
  }

  // If no end date, return null
  if (!task.end_date) {
    return null;
  }

  const now = new Date();
  const end = new Date(task.end_date);

  // Calculate difference in milliseconds and convert to days
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Calculate duration in days between two dates
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of days between dates
 */
export function calculateDuration(startDate: Date | string, endDate: Date | string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Calculate difference in milliseconds and convert to days
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Validate date range - endDate must be >= startDate
 * @param startDate - Start date string
 * @param endDate - End date string
 * @throws ValidationError if date range is invalid
 */
function validateDateRange(startDate?: string, endDate?: string): void {
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Check if dates are valid
    if (isNaN(start.getTime())) {
      throw new ValidationError('Invalid start date format');
    }
    if (isNaN(end.getTime())) {
      throw new ValidationError('Invalid end date format');
    }
    
    // Check if end date is before start date
    if (end < start) {
      throw new ValidationError('End date must be greater than or equal to start date');
    }
  }
}

export interface CreateTaskDTO {
  name: string;
  description?: string;
  phase: string;
  estimated_duration_days: number;
  assigned_to?: string;
  startDate?: string;
  endDate?: string;
  autoProgressEnabled?: boolean;
}

export interface UpdateTaskDTO {
  name?: string;
  description?: string;
  phase?: string;
  estimated_duration_days?: number;
  assigned_to?: string;
  startDate?: string;
  endDate?: string;
  autoProgressEnabled?: boolean;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  created_at: Date;
  created_by: string | null;
}

export interface TaskProgress {
  id: string;
  task_id: string;
  progress_percentage: number;
  notes: string | null;
  updated_by: string;
  created_at: Date;
}

export interface TaskTree {
  tasks: Task[];
  dependencies: TaskDependency[];
}

/**
 * Create a new task for a project
 */
export async function createTask(
  projectId: string,
  data: CreateTaskDTO,
  userId: string
): Promise<Task> {
  // Validate input
  if (!data.name || data.name.trim().length === 0) {
    throw new ValidationError('Task name is required');
  }

  if (!data.phase || data.phase.trim().length === 0) {
    throw new ValidationError('Task phase is required');
  }

  if (!data.estimated_duration_days || data.estimated_duration_days <= 0) {
    throw new ValidationError('Estimated duration must be a positive number');
  }

  // Validate date range if both dates are provided
  validateDateRange(data.startDate, data.endDate);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify project exists and user has access
    const projectCheck = await client.query(
      `SELECT p.id 
       FROM projects p
       LEFT JOIN project_team_members ptm ON p.id = ptm.project_id
       LEFT JOIN users u ON u.id = $2
       WHERE p.id = $1 
       AND (ptm.user_id = $2 OR u.role IN ('Admin', 'Project_Manager'))`,
      [projectId, userId]
    );

    if (projectCheck.rows.length === 0) {
      throw new NotFoundError('Project not found or access denied');
    }

    // If assigned_to is provided, verify user exists
    if (data.assigned_to) {
      const userCheck = await client.query(
        'SELECT id FROM users WHERE id = $1',
        [data.assigned_to]
      );

      if (userCheck.rows.length === 0) {
        throw new ValidationError('Assigned user not found');
      }
    }

    // Create task with date fields
    const result = await client.query(
      `INSERT INTO tasks (
        project_id, name, description, phase, estimated_duration_days, 
        assigned_to, created_by, start_date, end_date, auto_progress_enabled
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        projectId,
        data.name.trim(),
        data.description?.trim() || null,
        data.phase.trim(),
        data.estimated_duration_days,
        data.assigned_to || null,
        userId,
        data.startDate || null,
        data.endDate || null,
        data.autoProgressEnabled !== undefined ? data.autoProgressEnabled : true,
      ]
    );

    await client.query('COMMIT');

    logger.info('Task created', {
      taskId: result.rows[0].id,
      projectId,
      userId,
    });

    // Invalidate forecast cache
    await forecastService.invalidateForecast(projectId);

    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating task', { error, projectId, userId });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update an existing task
 */
export async function updateTask(
  taskId: string,
  data: UpdateTaskDTO,
  userId: string
): Promise<Task> {
  // Validate input
  if (data.name !== undefined && data.name.trim().length === 0) {
    throw new ValidationError('Task name cannot be empty');
  }

  if (data.phase !== undefined && data.phase.trim().length === 0) {
    throw new ValidationError('Task phase cannot be empty');
  }

  if (
    data.estimated_duration_days !== undefined &&
    data.estimated_duration_days <= 0
  ) {
    throw new ValidationError('Estimated duration must be a positive number');
  }

  // Validate date range if dates are being updated
  validateDateRange(data.startDate, data.endDate);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify task exists and user has access
    const taskCheck = await client.query(
      `SELECT t.id, t.project_id, t.start_date, t.end_date
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       LEFT JOIN project_team_members ptm ON p.id = ptm.project_id
       LEFT JOIN users u ON u.id = $2
       WHERE t.id = $1 
       AND (ptm.user_id = $2 OR u.role IN ('Admin', 'Project_Manager'))`,
      [taskId, userId]
    );

    if (taskCheck.rows.length === 0) {
      throw new NotFoundError('Task not found or access denied');
    }

    // If only one date is being updated, validate with existing date
    const existingTask = taskCheck.rows[0];
    if (data.startDate && !data.endDate && existingTask.end_date) {
      validateDateRange(data.startDate, existingTask.end_date);
    }
    if (!data.startDate && data.endDate && existingTask.start_date) {
      validateDateRange(existingTask.start_date, data.endDate);
    }

    // If assigned_to is provided, verify user exists
    if (data.assigned_to) {
      const userCheck = await client.query(
        'SELECT id FROM users WHERE id = $1',
        [data.assigned_to]
      );

      if (userCheck.rows.length === 0) {
        throw new ValidationError('Assigned user not found');
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(data.name.trim());
    }

    if (data.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(data.description?.trim() || null);
    }

    if (data.phase !== undefined) {
      updates.push(`phase = $${paramCount++}`);
      values.push(data.phase.trim());
    }

    if (data.estimated_duration_days !== undefined) {
      updates.push(`estimated_duration_days = $${paramCount++}`);
      values.push(data.estimated_duration_days);
    }

    if (data.assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramCount++}`);
      values.push(data.assigned_to || null);
    }

    if (data.startDate !== undefined) {
      updates.push(`start_date = $${paramCount++}`);
      values.push(data.startDate || null);
    }

    if (data.endDate !== undefined) {
      updates.push(`end_date = $${paramCount++}`);
      values.push(data.endDate || null);
    }

    if (data.autoProgressEnabled !== undefined) {
      updates.push(`auto_progress_enabled = $${paramCount++}`);
      values.push(data.autoProgressEnabled);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update');
    }

    values.push(taskId);

    const result = await client.query(
      `UPDATE tasks 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    await client.query('COMMIT');

    logger.info('Task updated', { taskId, userId });

    // Invalidate forecast cache
    const projectId = taskCheck.rows[0].project_id;
    await forecastService.invalidateForecast(projectId);

    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating task', { error, taskId, userId });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete a task and all its dependencies
 */
export async function deleteTask(taskId: string, userId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify task exists and user has access
    const taskCheck = await client.query(
      `SELECT t.id, t.project_id
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       LEFT JOIN project_team_members ptm ON p.id = ptm.project_id
       LEFT JOIN users u ON u.id = $2
       WHERE t.id = $1 
       AND (ptm.user_id = $2 OR u.role IN ('Admin', 'Project_Manager'))`,
      [taskId, userId]
    );

    if (taskCheck.rows.length === 0) {
      throw new NotFoundError('Task not found or access denied');
    }

    // Delete task (dependencies will be cascade deleted)
    await client.query('DELETE FROM tasks WHERE id = $1', [taskId]);

    await client.query('COMMIT');

    logger.info('Task deleted', { taskId, userId });

    // Invalidate forecast cache
    const projectId = taskCheck.rows[0].project_id;
    await forecastService.invalidateForecast(projectId);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error deleting task', { error, taskId, userId });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get a single task by ID
 */
export async function getTask(taskId: string, userId: string): Promise<Task> {
  const result = await pool.query(
    `SELECT t.*
     FROM tasks t
     JOIN projects p ON t.project_id = p.id
     LEFT JOIN project_team_members ptm ON p.id = ptm.project_id
     LEFT JOIN users u ON u.id = $2
     WHERE t.id = $1 
     AND (ptm.user_id = $2 OR u.role IN ('Admin', 'Project_Manager'))`,
    [taskId, userId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Task not found or access denied');
  }

  return result.rows[0];
}

/**
 * List all tasks for a project
 */
export async function listTasksByProject(
  projectId: string,
  userId: string
): Promise<Task[]> {
  // Verify user has access to project
  const projectCheck = await pool.query(
    `SELECT p.id 
     FROM projects p
     LEFT JOIN project_team_members ptm ON p.id = ptm.project_id
     LEFT JOIN users u ON u.id = $2
     WHERE p.id = $1 
     AND (ptm.user_id = $2 OR u.role IN ('Admin', 'Project_Manager'))`,
    [projectId, userId]
  );

  if (projectCheck.rows.length === 0) {
    throw new NotFoundError('Project not found or access denied');
  }

  const result = await pool.query(
    `SELECT * FROM tasks 
     WHERE project_id = $1 
     ORDER BY phase, created_at`,
    [projectId]
  );

  return result.rows;
}

/**
 * Detect circular dependencies using DFS
 * Checks if adding a dependency from taskId to dependsOnTaskId would create a cycle
 */
async function hasCircularDependency(
  taskId: string,
  dependsOnTaskId: string,
  client: PoolClient
): Promise<boolean> {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  async function dfs(currentTaskId: string): Promise<boolean> {
    // If we reach taskId while traversing from dependsOnTaskId, we have a cycle
    if (currentTaskId === taskId) {
      return true; // Circular dependency detected
    }

    if (recursionStack.has(currentTaskId)) {
      return true; // Circular dependency detected
    }

    if (visited.has(currentTaskId)) {
      return false; // Already visited, no cycle from this node
    }

    visited.add(currentTaskId);
    recursionStack.add(currentTaskId);

    // Get all tasks that currentTaskId depends on
    const result = await client.query(
      'SELECT depends_on_task_id FROM task_dependencies WHERE task_id = $1',
      [currentTaskId]
    );

    for (const row of result.rows) {
      if (await dfs(row.depends_on_task_id)) {
        return true;
      }
    }

    recursionStack.delete(currentTaskId);
    return false;
  }

  // Check if dependsOnTaskId eventually depends on taskId
  return await dfs(dependsOnTaskId);
}

/**
 * Add a dependency between two tasks
 */
export async function addDependency(
  taskId: string,
  dependsOnTaskId: string,
  userId: string
): Promise<void> {
  if (taskId === dependsOnTaskId) {
    throw new ValidationError('A task cannot depend on itself');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify both tasks exist and belong to the same project
    const tasksCheck = await client.query(
      `SELECT t1.id as task1_id, t1.project_id as project1_id,
              t2.id as task2_id, t2.project_id as project2_id
       FROM tasks t1
       CROSS JOIN tasks t2
       WHERE t1.id = $1 AND t2.id = $2`,
      [taskId, dependsOnTaskId]
    );

    if (tasksCheck.rows.length === 0) {
      throw new NotFoundError('One or both tasks not found');
    }

    const { project1_id, project2_id } = tasksCheck.rows[0];

    if (project1_id !== project2_id) {
      throw new ValidationError(
        'Tasks must belong to the same project to create a dependency'
      );
    }

    // Verify user has access to the project
    const accessCheck = await client.query(
      `SELECT p.id 
       FROM projects p
       LEFT JOIN project_team_members ptm ON p.id = ptm.project_id
       LEFT JOIN users u ON u.id = $2
       WHERE p.id = $1 
       AND (ptm.user_id = $2 OR u.role IN ('Admin', 'Project_Manager'))`,
      [project1_id, userId]
    );

    if (accessCheck.rows.length === 0) {
      throw new AuthorizationError('Access denied to project');
    }

    // Check if dependency already exists
    const existingDep = await client.query(
      'SELECT id FROM task_dependencies WHERE task_id = $1 AND depends_on_task_id = $2',
      [taskId, dependsOnTaskId]
    );

    if (existingDep.rows.length > 0) {
      throw new ValidationError('Dependency already exists');
    }

    // Check for circular dependencies
    const wouldCreateCycle = await hasCircularDependency(
      taskId,
      dependsOnTaskId,
      client
    );

    if (wouldCreateCycle) {
      throw new ValidationError(
        'Cannot add dependency: would create a circular dependency'
      );
    }

    // Create dependency
    await client.query(
      `INSERT INTO task_dependencies (task_id, depends_on_task_id, created_by)
       VALUES ($1, $2, $3)`,
      [taskId, dependsOnTaskId, userId]
    );

    await client.query('COMMIT');

    logger.info('Task dependency added', { taskId, dependsOnTaskId, userId });

    // Invalidate forecast cache
    await forecastService.invalidateForecast(project1_id);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error adding task dependency', {
      error,
      taskId,
      dependsOnTaskId,
      userId,
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Remove a dependency between two tasks
 */
export async function removeDependency(
  taskId: string,
  dependsOnTaskId: string,
  userId: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify dependency exists and user has access
    const depCheck = await client.query(
      `SELECT td.id, t.project_id
       FROM task_dependencies td
       JOIN tasks t ON td.task_id = t.id
       JOIN projects p ON t.project_id = p.id
       LEFT JOIN project_team_members ptm ON p.id = ptm.project_id
       LEFT JOIN users u ON u.id = $3
       WHERE td.task_id = $1 AND td.depends_on_task_id = $2
       AND (ptm.user_id = $3 OR u.role IN ('Admin', 'Project_Manager'))`,
      [taskId, dependsOnTaskId, userId]
    );

    if (depCheck.rows.length === 0) {
      throw new NotFoundError('Dependency not found or access denied');
    }

    // Delete dependency
    await client.query(
      'DELETE FROM task_dependencies WHERE task_id = $1 AND depends_on_task_id = $2',
      [taskId, dependsOnTaskId]
    );

    await client.query('COMMIT');

    logger.info('Task dependency removed', {
      taskId,
      dependsOnTaskId,
      userId,
    });

    // Invalidate forecast cache
    const projectId = depCheck.rows[0].project_id;
    await forecastService.invalidateForecast(projectId);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error removing task dependency', {
      error,
      taskId,
      dependsOnTaskId,
      userId,
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get the task dependency tree for a project
 */
export async function getTaskDependencyTree(
  projectId: string,
  userId: string
): Promise<TaskTree> {
  // Verify user has access to project
  const projectCheck = await pool.query(
    `SELECT p.id 
     FROM projects p
     LEFT JOIN project_team_members ptm ON p.id = ptm.project_id
     LEFT JOIN users u ON u.id = $2
     WHERE p.id = $1 
     AND (ptm.user_id = $2 OR u.role IN ('Admin', 'Project_Manager'))`,
    [projectId, userId]
  );

  if (projectCheck.rows.length === 0) {
    throw new NotFoundError('Project not found or access denied');
  }

  // Get all tasks for the project
  const tasksResult = await pool.query(
    'SELECT * FROM tasks WHERE project_id = $1 ORDER BY phase, created_at',
    [projectId]
  );

  // Get all dependencies for tasks in this project
  const depsResult = await pool.query(
    `SELECT td.*
     FROM task_dependencies td
     JOIN tasks t ON td.task_id = t.id
     WHERE t.project_id = $1`,
    [projectId]
  );

  return {
    tasks: tasksResult.rows,
    dependencies: depsResult.rows,
  };
}

/**
 * Update task progress
 */
export async function updateProgress(
  taskId: string,
  progress: number,
  notes: string | undefined,
  userId: string
): Promise<TaskProgress> {
  // Validate progress percentage
  if (progress < 0 || progress > 100) {
    throw new ValidationError('Progress percentage must be between 0 and 100');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify task exists and user has access
    const taskCheck = await client.query(
      `SELECT t.id, t.project_id, t.progress_percentage
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       LEFT JOIN project_team_members ptm ON p.id = ptm.project_id
       LEFT JOIN users u ON u.id = $2
       WHERE t.id = $1 
       AND (ptm.user_id = $2 OR u.role IN ('Admin', 'Project_Manager', 'Team_Member'))`,
      [taskId, userId]
    );

    if (taskCheck.rows.length === 0) {
      throw new NotFoundError('Task not found or access denied');
    }

    // Update task progress
    const isCompleted = progress === 100;
    await client.query(
      `UPDATE tasks 
       SET progress_percentage = $1, 
           is_completed = $2,
           completed_at = CASE WHEN $2 = true THEN CURRENT_TIMESTAMP ELSE completed_at END,
           actual_duration_days = CASE 
             WHEN $2 = true AND actual_duration_days IS NULL 
             THEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::integer 
             ELSE actual_duration_days 
           END
       WHERE id = $3`,
      [progress, isCompleted, taskId]
    );

    // Record progress history
    const historyResult = await client.query(
      `INSERT INTO task_progress_history (task_id, progress_percentage, notes, updated_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [taskId, progress, notes || null, userId]
    );

    await client.query('COMMIT');

    logger.info('Task progress updated', { taskId, progress, userId });

    // Invalidate forecast cache
    const projectId = taskCheck.rows[0].project_id;
    await forecastService.invalidateForecast(projectId);

    return historyResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating task progress', { error, taskId, userId });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get progress history for a task
 */
export async function getProgressHistory(
  taskId: string,
  userId: string
): Promise<TaskProgress[]> {
  // Verify task exists and user has access
  const taskCheck = await pool.query(
    `SELECT t.id
     FROM tasks t
     JOIN projects p ON t.project_id = p.id
     LEFT JOIN project_team_members ptm ON p.id = ptm.project_id
     LEFT JOIN users u ON u.id = $2
     WHERE t.id = $1 
     AND (ptm.user_id = $2 OR u.role IN ('Admin', 'Project_Manager', 'Team_Member'))`,
    [taskId, userId]
  );

  if (taskCheck.rows.length === 0) {
    throw new NotFoundError('Task not found or access denied');
  }

const result = await pool.query(
  `SELECT 
     tph.id,
     tph.task_id,
     tph.progress_percentage,
     tph.notes,
     tph.updated_by,
     tph.created_at,
     CONCAT(u.first_name, ' ', u.last_name) AS updated_by_username
   FROM task_progress_history tph
   LEFT JOIN users u ON tph.updated_by = u.id
   WHERE tph.task_id = $1 
   ORDER BY tph.created_at ASC`,
  [taskId]
);

  return result.rows;
}
