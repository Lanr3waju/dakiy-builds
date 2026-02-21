import { Router, Response } from 'express';
import {
  createTask,
  updateTask,
  deleteTask,
  getTask,
  listTasksByProject,
  getTaskDependencyTree,
  addDependency,
  removeDependency,
  updateProgress,
  getProgressHistory,
  CreateTaskDTO,
  UpdateTaskDTO,
  Task,
  calculateAutoProgress,
  determineTaskStatus,
  calculateDaysRemaining,
  calculateDuration,
} from '../services/task.service';
import {
  authenticate,
  AuthenticatedRequest,
} from '../middleware/auth.middleware';
import { ValidationError } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';

const router = Router();

// All task routes require authentication
router.use(authenticate);

/**
 * Enrich task with calculated fields
 * Handles both date-based and legacy duration-based tasks
 */
function enrichTaskWithCalculatedFields(task: Task) {
  const enriched: any = { ...task };
  
  // Calculate duration if dates are present (date-based tasks)
  if (task.start_date && task.end_date) {
    enriched.duration = calculateDuration(task.start_date, task.end_date);
  }
  // For legacy tasks without dates, duration comes from estimated_duration_days
  
  // Calculate days remaining (returns null for legacy tasks without end_date)
  enriched.days_remaining = calculateDaysRemaining(task);
  
  // Determine status (returns 'in_progress' for legacy tasks without dates)
  enriched.status = determineTaskStatus(task);
  
  // Calculate auto progress if enabled (returns current progress for legacy tasks)
  if (task.auto_progress_enabled) {
    enriched.auto_progress = calculateAutoProgress(task);
  }
  
  return enriched;
}

/**
 * POST /api/projects/:projectId/tasks
 * Create a new task
 */
router.post(
  '/projects/:projectId/tasks',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { projectId } = req.params;
    const { 
      name, 
      description, 
      phase, 
      estimatedDurationDays, 
      assignedTo,
      startDate,
      endDate,
      autoProgressEnabled
    } = req.body;

    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    if (!name || !phase) {
      throw new ValidationError('Name and phase are required');
    }

    const taskDTO: CreateTaskDTO = {
      name,
      description,
      phase,
      estimated_duration_days: estimatedDurationDays ? parseInt(estimatedDurationDays) : 1,
      assigned_to: assignedTo,
      startDate,
      endDate,
      autoProgressEnabled,
    };

    const task = await createTask(projectId, taskDTO, req.user!.id);

    logger.info('Task created', { taskId: task.id, projectId, createdBy: req.user!.id });

    // Enrich task with calculated fields
    const enrichedTask = enrichTaskWithCalculatedFields(task);

    res.status(201).json({
      success: true,
      data: enrichedTask,
    });
  })
);

/**
 * PUT /api/tasks/:id
 * Update an existing task
 */
router.put(
  '/tasks/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { 
      name, 
      description, 
      phase, 
      estimatedDurationDays, 
      assignedTo,
      startDate,
      endDate,
      autoProgressEnabled
    } = req.body;

    if (!id) {
      throw new ValidationError('Task ID is required');
    }

    const updateDTO: UpdateTaskDTO = {};
    if (name !== undefined) updateDTO.name = name;
    if (description !== undefined) updateDTO.description = description;
    if (phase !== undefined) updateDTO.phase = phase;
    if (estimatedDurationDays !== undefined) updateDTO.estimated_duration_days = parseInt(estimatedDurationDays);
    if (assignedTo !== undefined) updateDTO.assigned_to = assignedTo;
    if (startDate !== undefined) updateDTO.startDate = startDate;
    if (endDate !== undefined) updateDTO.endDate = endDate;
    if (autoProgressEnabled !== undefined) updateDTO.autoProgressEnabled = autoProgressEnabled;

    const updatedTask = await updateTask(id, updateDTO, req.user!.id);

    logger.info('Task updated', { taskId: id, updatedBy: req.user!.id });

    // Enrich task with calculated fields
    const enrichedTask = enrichTaskWithCalculatedFields(updatedTask);

    res.status(200).json({
      success: true,
      data: enrichedTask,
    });
  })
);

/**
 * DELETE /api/tasks/:id
 * Delete a task
 */
router.delete(
  '/tasks/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('Task ID is required');
    }

    await deleteTask(id, req.user!.id);

    logger.info('Task deleted', { taskId: id, deletedBy: req.user!.id });

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
    });
  })
);

/**
 * GET /api/tasks/:id
 * Get task details
 */
router.get(
  '/tasks/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('Task ID is required');
    }

    const task = await getTask(id, req.user!.id);

    // Enrich task with calculated fields
    const enrichedTask = enrichTaskWithCalculatedFields(task);

    res.status(200).json({
      success: true,
      data: enrichedTask,
    });
  })
);

/**
 * GET /api/projects/:projectId/tasks
 * List tasks for a project
 */
router.get(
  '/projects/:projectId/tasks',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { projectId } = req.params;

    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    const tasks = await listTasksByProject(projectId, req.user!.id);

    // Enrich all tasks with calculated fields
    const enrichedTasks = tasks.map(task => enrichTaskWithCalculatedFields(task));

    res.status(200).json({
      success: true,
      data: enrichedTasks,
      count: enrichedTasks.length,
    });
  })
);

/**
 * GET /api/projects/:projectId/tasks/tree
 * Get dependency tree for project tasks
 */
router.get(
  '/projects/:projectId/tasks/tree',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { projectId } = req.params;

    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    const tree = await getTaskDependencyTree(projectId, req.user!.id);

    res.status(200).json({
      success: true,
      data: tree,
    });
  })
);

export default router;

/**
 * POST /api/tasks/:id/dependencies
 * Add a dependency to a task
 */
router.post(
  '/tasks/:id/dependencies',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { dependsOnTaskId } = req.body;

    if (!id) {
      throw new ValidationError('Task ID is required');
    }

    if (!dependsOnTaskId) {
      throw new ValidationError('dependsOnTaskId is required');
    }

    await addDependency(id, dependsOnTaskId, req.user!.id);

    logger.info('Task dependency added', { taskId: id, dependsOnTaskId, addedBy: req.user!.id });

    res.status(200).json({
      success: true,
      message: 'Dependency added successfully',
    });
  })
);

/**
 * DELETE /api/tasks/:id/dependencies/:dependencyId
 * Remove a dependency from a task
 */
router.delete(
  '/tasks/:id/dependencies/:dependencyId',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id, dependencyId } = req.params;

    if (!id || !dependencyId) {
      throw new ValidationError('Task ID and Dependency ID are required');
    }

    await removeDependency(id, dependencyId, req.user!.id);

    logger.info('Task dependency removed', { taskId: id, dependencyId, removedBy: req.user!.id });

    res.status(200).json({
      success: true,
      message: 'Dependency removed successfully',
    });
  })
);

/**
 * POST /api/tasks/:id/progress
 * Update task progress
 */
router.post(
  '/tasks/:id/progress',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { progressPercentage, notes } = req.body;

    if (!id) {
      throw new ValidationError('Task ID is required');
    }

    if (progressPercentage === undefined || progressPercentage === null) {
      throw new ValidationError('progressPercentage is required');
    }

    const percentage = parseFloat(progressPercentage);

    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      throw new ValidationError('progressPercentage must be between 0 and 100');
    }

    await updateProgress(id, percentage, notes, req.user!.id);

    logger.info('Task progress updated', { taskId: id, progressPercentage: percentage, updatedBy: req.user!.id });

    res.status(200).json({
      success: true,
      message: 'Progress updated successfully',
    });
  })
);

/**
 * GET /api/tasks/:id/progress
 * Get task progress history
 */
router.get(
  '/tasks/:id/progress',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('Task ID is required');
    }

    const history = await getProgressHistory(id, req.user!.id);

    res.status(200).json({
      success: true,
      data: history,
      count: history.length,
    });
  })
);
