import { pool } from '../config/database';
import {
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
} from '../utils/errors';
import logger from '../utils/logger';

export type ProjectRole = 'Admin' | 'Project_Manager' | 'Team_Member';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  location: string;
  budget: number | null;
  startDate: Date;
  endDate: Date | null;
  plannedCompletionDate: Date;
  ownerId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectDTO {
  name: string;
  description?: string;
  location: string;
  budget?: number;
  startDate: Date;
  endDate?: Date;
  plannedCompletionDate: Date;
}

export interface UpdateProjectDTO {
  name?: string;
  description?: string;
  location?: string;
  budget?: number;
  startDate?: Date;
  endDate?: Date;
  plannedCompletionDate?: Date;
  isActive?: boolean;
}

export interface ProjectFilters {
  isActive?: boolean;
  startDateFrom?: Date;
  startDateTo?: Date;
  ownerId?: string;
}

/**
 * Validate project name
 * @param name - Project name to validate
 * @returns True if valid
 */
function isValidProjectName(name: string): boolean {
  return !!name && name.trim().length > 0 && name.length <= 255;
}

/**
 * Validate location
 * @param location - Location to validate
 * @returns True if valid
 */
function isValidLocation(location: string): boolean {
  return !!location && location.trim().length > 0 && location.length <= 255;
}

/**
 * Validate budget
 * @param budget - Budget to validate
 * @returns True if valid
 */
function isValidBudget(budget: number): boolean {
  return budget >= 0;
}

/**
 * Validate date order
 * @param startDate - Start date
 * @param endDate - End date
 * @returns True if valid
 */
function isValidDateOrder(startDate: Date, endDate: Date): boolean {
  return startDate <= endDate;
}

/**
 * Check if user has required role for project creation
 * @param userId - User ID
 * @returns User role
 * @throws AuthorizationError if user doesn't have permission
 */
async function requireProjectCreationRole(userId: string): Promise<string> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('User');
    }

    const role = result.rows[0].role;

    if (role !== 'Admin' && role !== 'Project_Manager') {
      throw new AuthorizationError('Only Admin and Project_Manager can create projects');
    }

    return role;
  } finally {
    client.release();
  }
}

/**
 * Check if user has access to a project
 * @param projectId - Project ID
 * @param userId - User ID
 * @returns True if user has access
 */
async function hasProjectAccess(projectId: string, userId: string): Promise<boolean> {
  const client = await pool.connect();
  
  try {
    // Check if user is admin
    const userResult = await client.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return false;
    }

    // Admins have access to all projects
    if (userResult.rows[0].role === 'Admin') {
      return true;
    }

    // Check if user is project owner
    const ownerResult = await client.query(
      'SELECT id FROM projects WHERE id = $1 AND owner_id = $2',
      [projectId, userId]
    );

    if (ownerResult.rows.length > 0) {
      return true;
    }

    // Check if user is a team member
    const teamResult = await client.query(
      'SELECT id FROM project_team_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );

    return teamResult.rows.length > 0;
  } finally {
    client.release();
  }
}

/**
 * Create audit log entry for project updates
 * @param client - Database client
 * @param projectId - Project ID
 * @param userId - User ID who made the change
 * @param action - Action performed
 * @param details - Additional details
 */
async function createAuditLog(
  client: any,
  projectId: string,
  userId: string,
  action: string,
  details: any
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (entity_type, entity_id, user_id, action, details)
     VALUES ($1, $2, $3, $4, $5)`,
    ['project', projectId, userId, action, JSON.stringify(details)]
  );
}

/**
 * Create a new project with metadata validation
 * Only Project_Manager and Admin can create projects
 * Project owner is automatically assigned to the creating user
 * @param data - Project creation data
 * @param userId - ID of user creating the project
 * @returns Created project
 * @throws ValidationError if input is invalid
 * @throws AuthorizationError if user doesn't have permission
 */
export async function createProject(
  data: CreateProjectDTO,
  userId: string
): Promise<Project> {
  // Check user has permission to create projects
  await requireProjectCreationRole(userId);

  // Validate required fields
  if (!data.name || !data.location || !data.startDate || !data.plannedCompletionDate) {
    throw new ValidationError('Name, location, start date, and planned completion date are required');
  }

  // Validate name
  if (!isValidProjectName(data.name)) {
    throw new ValidationError('Project name must be between 1 and 255 characters');
  }

  // Validate location
  if (!isValidLocation(data.location)) {
    throw new ValidationError('Location must be between 1 and 255 characters');
  }

  // Validate budget if provided
  if (data.budget !== undefined && !isValidBudget(data.budget)) {
    throw new ValidationError('Budget must be a positive number');
  }

  // Validate date order
  const startDate = new Date(data.startDate);
  const plannedCompletionDate = new Date(data.plannedCompletionDate);

  if (!isValidDateOrder(startDate, plannedCompletionDate)) {
    throw new ValidationError('Start date must be before or equal to planned completion date');
  }

  if (data.endDate) {
    const endDate = new Date(data.endDate);
    if (!isValidDateOrder(startDate, endDate)) {
      throw new ValidationError('Start date must be before or equal to end date');
    }
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert project
    const projectQuery = `
      INSERT INTO projects (name, description, location, budget, start_date, end_date, planned_completion_date, owner_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, description, location, budget, start_date, end_date, planned_completion_date, owner_id, is_active, created_at, updated_at
    `;

    const projectResult = await client.query(projectQuery, [
      data.name.trim(),
      data.description?.trim() || null,
      data.location.trim(),
      data.budget || null,
      startDate,
      data.endDate ? new Date(data.endDate) : null,
      plannedCompletionDate,
      userId,
    ]);

    const project = projectResult.rows[0];

    // Automatically assign owner as team member with Owner role
    await client.query(
      `INSERT INTO project_team_members (project_id, user_id, role, assigned_by)
       VALUES ($1, $2, $3, $4)`,
      [project.id, userId, 'Admin', userId]
    );

    // Create audit log
    await createAuditLog(client, project.id, userId, 'create', {
      name: project.name,
      location: project.location,
    });

    await client.query('COMMIT');

    logger.info('Project created successfully', {
      projectId: project.id,
      name: project.name,
      ownerId: userId,
    });

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      location: project.location,
      budget: project.budget ? parseFloat(project.budget) : null,
      startDate: project.start_date,
      endDate: project.end_date,
      plannedCompletionDate: project.planned_completion_date,
      ownerId: project.owner_id,
      isActive: project.is_active,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    
    if (
      error instanceof ValidationError ||
      error instanceof AuthorizationError
    ) {
      throw error;
    }
    logger.error('Project creation failed', { error, name: data.name });
    throw new DatabaseError('Failed to create project');
  } finally {
    client.release();
  }
}

/**
 * Update an existing project with audit trail
 * Only users with access to the project can update it
 * @param projectId - ID of project to update
 * @param data - Update data
 * @param userId - ID of user making the update
 * @returns Updated project
 * @throws ValidationError if input is invalid
 * @throws AuthorizationError if user doesn't have permission
 * @throws NotFoundError if project doesn't exist
 */
export async function updateProject(
  projectId: string,
  data: UpdateProjectDTO,
  userId: string
): Promise<Project> {
  // Validate at least one field is provided
  if (Object.keys(data).length === 0) {
    throw new ValidationError('At least one field must be provided for update');
  }

  // Validate name if provided
  if (data.name !== undefined && !isValidProjectName(data.name)) {
    throw new ValidationError('Project name must be between 1 and 255 characters');
  }

  // Validate location if provided
  if (data.location !== undefined && !isValidLocation(data.location)) {
    throw new ValidationError('Location must be between 1 and 255 characters');
  }

  // Validate budget if provided
  if (data.budget !== undefined && !isValidBudget(data.budget)) {
    throw new ValidationError('Budget must be a positive number');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if project exists
    const existingProject = await client.query(
      'SELECT id, name, start_date, end_date, planned_completion_date FROM projects WHERE id = $1',
      [projectId]
    );

    if (existingProject.rows.length === 0) {
      throw new NotFoundError('Project');
    }

    // Check user has access
    const hasAccess = await hasProjectAccess(projectId, userId);
    if (!hasAccess) {
      throw new AuthorizationError('You do not have access to this project');
    }

    const existing = existingProject.rows[0];

    // Validate date order if dates are being updated
    const startDate = data.startDate ? new Date(data.startDate) : new Date(existing.start_date);
    const endDate = data.endDate !== undefined 
      ? (data.endDate ? new Date(data.endDate) : null)
      : (existing.end_date ? new Date(existing.end_date) : null);
    const plannedCompletionDate = data.plannedCompletionDate 
      ? new Date(data.plannedCompletionDate) 
      : new Date(existing.planned_completion_date);

    if (!isValidDateOrder(startDate, plannedCompletionDate)) {
      throw new ValidationError('Start date must be before or equal to planned completion date');
    }

    if (endDate && !isValidDateOrder(startDate, endDate)) {
      throw new ValidationError('Start date must be before or equal to end date');
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name.trim());
    }

    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description?.trim() || null);
    }

    if (data.location !== undefined) {
      updates.push(`location = $${paramIndex++}`);
      values.push(data.location.trim());
    }

    if (data.budget !== undefined) {
      updates.push(`budget = $${paramIndex++}`);
      values.push(data.budget);
    }

    if (data.startDate !== undefined) {
      updates.push(`start_date = $${paramIndex++}`);
      values.push(startDate);
    }

    if (data.endDate !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      values.push(endDate);
    }

    if (data.plannedCompletionDate !== undefined) {
      updates.push(`planned_completion_date = $${paramIndex++}`);
      values.push(plannedCompletionDate);
    }

    if (data.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(data.isActive);
    }

    // Add projectId as last parameter
    values.push(projectId);

    const query = `
      UPDATE projects
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING id, name, description, location, budget, start_date, end_date, planned_completion_date, owner_id, is_active, created_at, updated_at
    `;

    const result = await client.query(query, values);
    const project = result.rows[0];

    // Create audit log
    await createAuditLog(client, projectId, userId, 'update', {
      fields: Object.keys(data),
      changes: data,
    });

    await client.query('COMMIT');

    logger.info('Project updated successfully', {
      projectId,
      updatedBy: userId,
      fields: Object.keys(data),
    });

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      location: project.location,
      budget: project.budget ? parseFloat(project.budget) : null,
      startDate: project.start_date,
      endDate: project.end_date,
      plannedCompletionDate: project.planned_completion_date,
      ownerId: project.owner_id,
      isActive: project.is_active,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    
    if (
      error instanceof ValidationError ||
      error instanceof AuthorizationError ||
      error instanceof NotFoundError
    ) {
      throw error;
    }
    logger.error('Project update failed', { error, projectId });
    throw new DatabaseError('Failed to update project');
  } finally {
    client.release();
  }
}

/**
 * Delete a project with cascading deletion
 * Removes project and all associated tasks and documents
 * Only users with access can delete projects
 * @param projectId - ID of project to delete
 * @param userId - ID of user making the deletion
 * @throws AuthorizationError if user doesn't have permission
 * @throws NotFoundError if project doesn't exist
 */
export async function deleteProject(
  projectId: string,
  userId: string
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if project exists
    const projectResult = await client.query(
      'SELECT id, name FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      throw new NotFoundError('Project');
    }

    // Check user has access
    const hasAccess = await hasProjectAccess(projectId, userId);
    if (!hasAccess) {
      throw new AuthorizationError('You do not have access to this project');
    }

    const projectName = projectResult.rows[0].name;

    // Create audit log before deletion
    await createAuditLog(client, projectId, userId, 'delete', {
      name: projectName,
    });

    // Delete project (cascade will handle tasks, documents, team members, etc.)
    await client.query('DELETE FROM projects WHERE id = $1', [projectId]);

    await client.query('COMMIT');

    logger.info('Project deleted successfully', {
      projectId,
      name: projectName,
      deletedBy: userId,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    
    if (
      error instanceof AuthorizationError ||
      error instanceof NotFoundError
    ) {
      throw error;
    }
    logger.error('Project deletion failed', { error, projectId });
    throw new DatabaseError('Failed to delete project');
  } finally {
    client.release();
  }
}

/**
 * Get a project by ID with access control
 * Users can only see projects they have access to
 * @param projectId - ID of project to retrieve
 * @param userId - ID of user making the request
 * @returns Project data
 * @throws AuthorizationError if user doesn't have permission
 * @throws NotFoundError if project doesn't exist
 */
export async function getProject(
  projectId: string,
  userId: string
): Promise<Project> {
  const client = await pool.connect();

  try {
    // Check user has access
    const hasAccess = await hasProjectAccess(projectId, userId);
    if (!hasAccess) {
      throw new AuthorizationError('You do not have access to this project');
    }

    // Get project
    const result = await client.query(
      `SELECT id, name, description, location, budget, start_date, end_date, planned_completion_date, owner_id, is_active, created_at, updated_at
       FROM projects
       WHERE id = $1`,
      [projectId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Project');
    }

    const project = result.rows[0];

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      location: project.location,
      budget: project.budget ? parseFloat(project.budget) : null,
      startDate: project.start_date,
      endDate: project.end_date,
      plannedCompletionDate: project.planned_completion_date,
      ownerId: project.owner_id,
      isActive: project.is_active,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    };
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      error instanceof NotFoundError
    ) {
      throw error;
    }
    logger.error('Get project failed', { error, projectId });
    throw new DatabaseError('Failed to retrieve project');
  } finally {
    client.release();
  }
}

/**
 * List projects with user filtering
 * Users can only see projects they have access to (team members or admins)
 * @param userId - ID of user making the request
 * @param filters - Optional filters
 * @returns Array of projects
 */
export async function listProjects(
  userId: string,
  filters?: ProjectFilters
): Promise<Project[]> {
  const client = await pool.connect();

  try {
    // Get user role
    const userResult = await client.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundError('User');
    }

    const userRole = userResult.rows[0].role;

    // Build query based on user role and filters
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // If not admin, filter by projects user has access to
    if (userRole !== 'Admin') {
      conditions.push(`(p.owner_id = $${paramIndex} OR EXISTS (
        SELECT 1 FROM project_team_members ptm 
        WHERE ptm.project_id = p.id AND ptm.user_id = $${paramIndex}
      ))`);
      values.push(userId);
      paramIndex++;
    }

    // Apply filters
    if (filters?.isActive !== undefined) {
      conditions.push(`p.is_active = $${paramIndex++}`);
      values.push(filters.isActive);
    }

    if (filters?.startDateFrom) {
      conditions.push(`p.start_date >= $${paramIndex++}`);
      values.push(new Date(filters.startDateFrom));
    }

    if (filters?.startDateTo) {
      conditions.push(`p.start_date <= $${paramIndex++}`);
      values.push(new Date(filters.startDateTo));
    }

    if (filters?.ownerId) {
      conditions.push(`p.owner_id = $${paramIndex++}`);
      values.push(filters.ownerId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT p.id, p.name, p.description, p.location, p.budget, p.start_date, p.end_date, 
             p.planned_completion_date, p.owner_id, p.is_active, p.created_at, p.updated_at
      FROM projects p
      ${whereClause}
      ORDER BY p.created_at DESC
    `;

    const result = await client.query(query, values);

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      location: row.location,
      budget: row.budget ? parseFloat(row.budget) : null,
      startDate: row.start_date,
      endDate: row.end_date,
      plannedCompletionDate: row.planned_completion_date,
      ownerId: row.owner_id,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    logger.error('List projects failed', { error });
    throw new DatabaseError('Failed to list projects');
  } finally {
    client.release();
  }
}
/**
 * Assign a team member to a project with a specific role
 * Only users with access to the project can assign team members
 * Prevents duplicate assignments
 * @param projectId - ID of the project
 * @param targetUserId - ID of the user to assign
 * @param role - Role to assign (Owner, Manager, Member, Viewer)
 * @param assignedBy - ID of user making the assignment
 * @throws ValidationError if input is invalid
 * @throws AuthorizationError if user doesn't have permission
 * @throws NotFoundError if project or user doesn't exist
 * @throws ConflictError if user is already assigned to the project
 */
export async function assignTeamMember(
  projectId: string,
  targetUserId: string,
  role: ProjectRole,
  assignedBy: string
): Promise<void> {
  // Validate role
  const validRoles: ProjectRole[] = ['Admin', 'Project_Manager', 'Team_Member',];
  if (!validRoles.includes(role)) {
    throw new ValidationError('Invalid role. Must be one of: Admin, Project_Manager, Team_Member');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if project exists
    const projectResult = await client.query(
      'SELECT id, name FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      throw new NotFoundError('Project');
    }

    // Check if target user exists
    const userResult = await client.query(
      'SELECT id FROM users WHERE id = $1',
      [targetUserId]
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundError('User');
    }

    // Check if assigning user has access to the project
    const hasAccess = await hasProjectAccess(projectId, assignedBy);
    if (!hasAccess) {
      throw new AuthorizationError('You do not have access to this project');
    }

    // Check if user is already assigned to the project
    const existingAssignment = await client.query(
      'SELECT id FROM project_team_members WHERE project_id = $1 AND user_id = $2',
      [projectId, targetUserId]
    );

    if (existingAssignment.rows.length > 0) {
      throw new ConflictError('User is already assigned to this project');
    }

    // Assign team member
    await client.query(
      `INSERT INTO project_team_members (project_id, user_id, role, assigned_by)
       VALUES ($1, $2, $3, $4)`,
      [projectId, targetUserId, role, assignedBy]
    );

    // Create audit log
    await createAuditLog(client, projectId, assignedBy, 'assign_team_member', {
      targetUserId,
      role,
    });

    await client.query('COMMIT');

    logger.info('Team member assigned successfully', {
      projectId,
      targetUserId,
      role,
      assignedBy,
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (
      error instanceof ValidationError ||
      error instanceof AuthorizationError ||
      error instanceof NotFoundError ||
      error instanceof ConflictError
    ) {
      throw error;
    }
    logger.error('Team member assignment failed', { error, projectId, targetUserId });
    throw new DatabaseError('Failed to assign team member');
  } finally {
    client.release();
  }
}

/**
 * Remove a team member from a project
 * Revokes the user's access to the project
 * Only users with access to the project can remove team members
 * @param projectId - ID of the project
 * @param targetUserId - ID of the user to remove
 * @param removedBy - ID of user making the removal
 * @throws AuthorizationError if user doesn't have permission
 * @throws NotFoundError if project or team member assignment doesn't exist
 */
export async function removeTeamMember(
  projectId: string,
  targetUserId: string,
  removedBy: string
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if project exists
    const projectResult = await client.query(
      'SELECT id, name FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      throw new NotFoundError('Project');
    }

    // Check if removing user has access to the project
    const hasAccess = await hasProjectAccess(projectId, removedBy);
    if (!hasAccess) {
      throw new AuthorizationError('You do not have access to this project');
    }

    // Check if team member assignment exists
    const assignmentResult = await client.query(
      'SELECT id, role FROM project_team_members WHERE project_id = $1 AND user_id = $2',
      [projectId, targetUserId]
    );

    if (assignmentResult.rows.length === 0) {
      throw new NotFoundError('Team member assignment');
    }

    const role = assignmentResult.rows[0].role;

    // Remove team member
    await client.query(
      'DELETE FROM project_team_members WHERE project_id = $1 AND user_id = $2',
      [projectId, targetUserId]
    );

    // Create audit log
    await createAuditLog(client, projectId, removedBy, 'remove_team_member', {
      targetUserId,
      role,
    });

    await client.query('COMMIT');

    logger.info('Team member removed successfully', {
      projectId,
      targetUserId,
      removedBy,
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (
      error instanceof AuthorizationError ||
      error instanceof NotFoundError
    ) {
      throw error;
    }
    logger.error('Team member removal failed', { error, projectId, targetUserId });
    throw new DatabaseError('Failed to remove team member');
  } finally {
    client.release();
  }
}
