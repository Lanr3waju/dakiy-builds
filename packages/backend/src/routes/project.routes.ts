import { Router, Response } from 'express';
import {
  createProject,
  updateProject,
  deleteProject,
  getProject,
  listProjects,
  assignTeamMember,
  removeTeamMember,
  CreateProjectDTO,
  UpdateProjectDTO,
  ProjectFilters,
} from '../services/project.service';
import {
  authenticate,
  requireProjectManager,
  AuthenticatedRequest,
} from '../middleware/auth.middleware';
import { ValidationError } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import { pool } from '../config/database';

const router = Router();

// All project routes require authentication
router.use(authenticate);

/**
 * POST /api/projects
 * Create a new project (Project_Manager or Admin only)
 */
router.post(
  '/',
  requireProjectManager,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name, location, budget, startDate, plannedCompletionDate, endDate, description } = req.body;

    if (!name || !location || !startDate || !plannedCompletionDate) {
      throw new ValidationError('Name, location, startDate, and plannedCompletionDate are required');
    }

    const projectDTO: CreateProjectDTO = {
      name,
      location,
      budget: budget ? parseFloat(budget) : undefined,
      startDate: new Date(startDate),
      plannedCompletionDate: new Date(plannedCompletionDate),
      endDate: endDate ? new Date(endDate) : undefined,
      description,
    };

    const project = await createProject(projectDTO, req.user!.id);

    logger.info('Project created', { projectId: project.id, createdBy: req.user!.id });

    res.status(201).json({
      success: true,
      data: project,
    });
  })
);

/**
 * PUT /api/projects/:id
 * Update an existing project
 */
router.put(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { name, location, budget, startDate, plannedCompletionDate, endDate, description, isActive } = req.body;

    if (!id) {
      throw new ValidationError('Project ID is required');
    }

    const updateDTO: UpdateProjectDTO = {};
    if (name !== undefined) updateDTO.name = name;
    if (location !== undefined) updateDTO.location = location;
    if (budget !== undefined) updateDTO.budget = parseFloat(budget);
    if (startDate !== undefined) updateDTO.startDate = new Date(startDate);
    if (plannedCompletionDate !== undefined) updateDTO.plannedCompletionDate = new Date(plannedCompletionDate);
    if (endDate !== undefined) updateDTO.endDate = new Date(endDate);
    if (description !== undefined) updateDTO.description = description;
    if (isActive !== undefined) updateDTO.isActive = isActive;

    const updatedProject = await updateProject(id, updateDTO, req.user!.id);

    logger.info('Project updated', { projectId: id, updatedBy: req.user!.id });

    res.status(200).json({
      success: true,
      data: updatedProject,
    });
  })
);

/**
 * DELETE /api/projects/:id
 * Delete a project
 */
router.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('Project ID is required');
    }

    await deleteProject(id, req.user!.id);

    logger.info('Project deleted', { projectId: id, deletedBy: req.user!.id });

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
    });
  })
);

/**
 * GET /api/projects/:id
 * Get project details
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('Project ID is required');
    }

    const project = await getProject(id, req.user!.id);

    res.status(200).json({
      success: true,
      data: project,
    });
  })
);

/**
 * GET /api/projects
 * List projects with optional filtering
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { isActive, startDateFrom, startDateTo, ownerId } = req.query;

    const filters: ProjectFilters = {};

    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }

    if (startDateFrom && typeof startDateFrom === 'string') {
      filters.startDateFrom = new Date(startDateFrom);
    }

    if (startDateTo && typeof startDateTo === 'string') {
      filters.startDateTo = new Date(startDateTo);
    }

    if (ownerId && typeof ownerId === 'string') {
      filters.ownerId = ownerId;
    }

    const projects = await listProjects(req.user!.id, filters);

    res.status(200).json({
      success: true,
      data: projects,
      count: projects.length,
    });
  })
);

/**
 * POST /api/projects/:id/team
 * Assign a team member to a project
 */
router.post(
  '/:id/team',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { userId, role } = req.body;

    if (!id) {
      throw new ValidationError('Project ID is required');
    }

    if (!userId || !role) {
      throw new ValidationError('userId and role are required');
    }

    await assignTeamMember(id, userId, role, req.user!.id);

    logger.info('Team member assigned', { projectId: id, userId, role, assignedBy: req.user!.id });

    res.status(200).json({
      success: true,
      message: 'Team member assigned successfully',
    });
  })
);

/**
 * DELETE /api/projects/:id/team/:userId
 * Remove a team member from a project
 */
router.delete(
  '/:id/team/:userId',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id, userId } = req.params;

    if (!id || !userId) {
      throw new ValidationError('Project ID and User ID are required');
    }

    await removeTeamMember(id, userId, req.user!.id);

    logger.info('Team member removed', { projectId: id, userId, removedBy: req.user!.id });

    res.status(200).json({
      success: true,
      message: 'Team member removed successfully',
    });
  })
);

/**
 * GET /api/projects/:id/team
 * List team members for a project
 */
router.get(
  '/:id/team',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('Project ID is required');
    }

    const client = await pool.connect();
    
    try {
      // Check user has access to the project
      await getProject(id, req.user!.id);

      // Get team members with user details
      const result = await client.query(
        `SELECT 
          ptm.user_id,
          ptm.role,
          ptm.assigned_at,
          u.first_name,
          u.last_name,
          u.email,
          u.role as user_role
         FROM project_team_members ptm
         JOIN users u ON ptm.user_id = u.id
         WHERE ptm.project_id = $1
         ORDER BY ptm.assigned_at DESC`,
        [id]
      );

      const teamMembers = result.rows.map(row => ({
        userId: row.user_id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        role: row.role,
        userRole: row.user_role,
        assignedAt: row.assigned_at,
      }));

      res.status(200).json({
        success: true,
        data: teamMembers,
      });
    } finally {
      client.release();
    }
  })
);

export default router;
