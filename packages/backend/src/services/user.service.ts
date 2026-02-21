import { pool } from '../config/database';
import { hashPassword } from './auth.service';
import {
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
} from '../utils/errors';
import logger from '../utils/logger';

export type UserRole = 'Admin' | 'Project_Manager' | 'Team_Member';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}

export interface UpdateUserDTO {
  email?: string;
  password?: string;
  role?: UserRole;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

/**
 * Validate email format
 * @param email - Email to validate
 * @returns True if valid
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns True if valid
 */
function isValidPassword(password: string): boolean {
  return !!password && password.length >= 8;
}

/**
 * Validate user role
 * @param role - Role to validate
 * @returns True if valid
 */
function isValidRole(role: string): role is UserRole {
  return ['Admin', 'Project_Manager', 'Team_Member'].includes(role);
}

/**
 * Check if requesting user has admin role
 * @param requestingUserId - ID of user making the request
 * @throws AuthorizationError if user is not an admin
 */
async function requireAdminRole(requestingUserId: string): Promise<void> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      'SELECT role FROM users WHERE id = $1',
      [requestingUserId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('User');
    }

    if (result.rows[0].role !== 'Admin') {
      throw new AuthorizationError('Only admins can perform this action');
    }
  } finally {
    client.release();
  }
}

/**
 * Create a new user with role assignment
 * Only admins can create users
 * @param data - User creation data
 * @param requestingUserId - ID of user making the request
 * @returns Created user
 * @throws ValidationError if input is invalid
 * @throws AuthorizationError if requesting user is not admin
 * @throws ConflictError if email already exists
 */
export async function createUser(
  data: CreateUserDTO,
  requestingUserId: string
): Promise<User> {
  // Check admin permission
  await requireAdminRole(requestingUserId);

  // Validate input
  if (!data.email || !data.password || !data.firstName || !data.lastName) {
    throw new ValidationError('Email, password, first name, and last name are required');
  }

  if (!isValidEmail(data.email)) {
    throw new ValidationError('Invalid email format');
  }

  if (!isValidPassword(data.password)) {
    throw new ValidationError('Password must be at least 8 characters long');
  }

  if (!isValidRole(data.role)) {
    throw new ValidationError('Invalid role. Must be Admin, Project_Manager, or Team_Member');
  }

  // Normalize email to lowercase
  const normalizedEmail = data.email.toLowerCase();

  const client = await pool.connect();

  try {
    // Check if email already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      throw new ConflictError('Email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Insert user
    const query = `
      INSERT INTO users (email, password_hash, role, first_name, last_name)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, role, first_name, last_name, is_active, created_at, updated_at
    `;

    const result = await client.query(query, [
      normalizedEmail,
      passwordHash,
      data.role,
      data.firstName,
      data.lastName,
    ]);

    const user = result.rows[0];

    logger.info('User created successfully', {
      userId: user.id,
      email: user.email,
      role: user.role,
      createdBy: requestingUserId,
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      isActive: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof AuthorizationError ||
      error instanceof ConflictError
    ) {
      throw error;
    }
    logger.error('User creation failed', { error, email: data.email });
    throw new DatabaseError('Failed to create user');
  } finally {
    client.release();
  }
}

/**
 * Update an existing user
 * Only admins can update users
 * @param userId - ID of user to update
 * @param data - Update data
 * @param requestingUserId - ID of user making the request
 * @returns Updated user
 * @throws ValidationError if input is invalid
 * @throws AuthorizationError if requesting user is not admin
 * @throws NotFoundError if user doesn't exist
 */
export async function updateUser(
  userId: string,
  data: UpdateUserDTO,
  requestingUserId: string
): Promise<User> {
  // Check admin permission
  await requireAdminRole(requestingUserId);

  // Validate input
  if (Object.keys(data).length === 0) {
    throw new ValidationError('At least one field must be provided for update');
  }

  if (data.email && !isValidEmail(data.email)) {
    throw new ValidationError('Invalid email format');
  }

  if (data.password && !isValidPassword(data.password)) {
    throw new ValidationError('Password must be at least 8 characters long');
  }

  if (data.role && !isValidRole(data.role)) {
    throw new ValidationError('Invalid role. Must be Admin, Project_Manager, or Team_Member');
  }

  const client = await pool.connect();

  try {
    // Check if user exists
    const existingUser = await client.query(
      'SELECT id, email FROM users WHERE id = $1',
      [userId]
    );

    if (existingUser.rows.length === 0) {
      throw new NotFoundError('User');
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.email) {
      const normalizedEmail = data.email.toLowerCase();
      
      // Check if new email already exists (for different user)
      const emailCheck = await client.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [normalizedEmail, userId]
      );

      if (emailCheck.rows.length > 0) {
        throw new ConflictError('Email already exists');
      }

      updates.push(`email = $${paramIndex++}`);
      values.push(normalizedEmail);
    }

    if (data.password) {
      const passwordHash = await hashPassword(data.password);
      updates.push(`password_hash = $${paramIndex++}`);
      values.push(passwordHash);
    }

    if (data.role) {
      updates.push(`role = $${paramIndex++}`);
      values.push(data.role);
    }

    if (data.firstName) {
      updates.push(`first_name = $${paramIndex++}`);
      values.push(data.firstName);
    }

    if (data.lastName) {
      updates.push(`last_name = $${paramIndex++}`);
      values.push(data.lastName);
    }

    if (data.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(data.isActive);
    }

    // Add userId as last parameter
    values.push(userId);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING id, email, role, first_name, last_name, is_active, created_at, updated_at
    `;

    const result = await client.query(query, values);
    const user = result.rows[0];

    logger.info('User updated successfully', {
      userId: user.id,
      updatedBy: requestingUserId,
      fields: Object.keys(data),
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      isActive: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof AuthorizationError ||
      error instanceof NotFoundError ||
      error instanceof ConflictError
    ) {
      throw error;
    }
    logger.error('User update failed', { error, userId });
    throw new DatabaseError('Failed to update user');
  } finally {
    client.release();
  }
}

/**
 * Update own profile (firstName and lastName only)
 * Any authenticated user can update their own profile
 * @param userId - ID of user updating their profile
 * @param data - Update data (only firstName and lastName allowed)
 * @returns Updated user
 * @throws ValidationError if input is invalid
 * @throws NotFoundError if user doesn't exist
 */
export async function updateOwnProfile(
  userId: string,
  data: { firstName?: string; lastName?: string }
): Promise<User> {
  // Validate input
  if (Object.keys(data).length === 0) {
    throw new ValidationError('At least one field must be provided for update');
  }

  // Only allow firstName and lastName updates
  const allowedFields = ['firstName', 'lastName'];
  const providedFields = Object.keys(data);
  const invalidFields = providedFields.filter(field => !allowedFields.includes(field));
  
  if (invalidFields.length > 0) {
    throw new ValidationError(`Cannot update fields: ${invalidFields.join(', ')}. Only firstName and lastName can be updated.`);
  }

  const client = await pool.connect();

  try {
    // Check if user exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (existingUser.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.firstName !== undefined) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(data.firstName.trim());
    }

    if (data.lastName !== undefined) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(data.lastName.trim());
    }

    values.push(userId);

    const result = await client.query(
      `UPDATE users 
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount}
       RETURNING id, email, first_name, last_name, role, is_active, created_at, updated_at`,
      values
    );

    logger.info('User profile updated', { userId });

    return result.rows[0];
  } finally {
    client.release();
  }
}


/**
 * Delete a user
 * Only admins can delete users
 * Prevents deletion of the last admin user
 * @param userId - ID of user to delete
 * @param requestingUserId - ID of user making the request
 * @throws AuthorizationError if requesting user is not admin
 * @throws NotFoundError if user doesn't exist
 * @throws ValidationError if attempting to delete last admin
 */
export async function deleteUser(
  userId: string,
  requestingUserId: string
): Promise<void> {
  // Check admin permission
  await requireAdminRole(requestingUserId);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if user exists
    const userResult = await client.query(
      'SELECT id, role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundError('User');
    }

    const userToDelete = userResult.rows[0];

    // If deleting an admin, check if it's the last admin
    if (userToDelete.role === 'Admin') {
      const adminCount = await client.query(
        'SELECT COUNT(*) as count FROM users WHERE role = $1 AND is_active = true',
        ['Admin']
      );

      if (parseInt(adminCount.rows[0].count) <= 1) {
        throw new ValidationError('Cannot delete the last admin user');
      }
    }

    // Delete user (cascade will handle sessions)
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');

    logger.info('User deleted successfully', {
      userId,
      deletedBy: requestingUserId,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    
    if (
      error instanceof ValidationError ||
      error instanceof AuthorizationError ||
      error instanceof NotFoundError
    ) {
      throw error;
    }
    logger.error('User deletion failed', { error, userId });
    throw new DatabaseError('Failed to delete user');
  } finally {
    client.release();
  }
}

/**
 * Get a user by ID
 * Users can view their own profile, admins can view all users
 * @param userId - ID of user to retrieve
 * @param requestingUserId - ID of user making the request
 * @returns User data
 * @throws AuthorizationError if user doesn't have permission
 * @throws NotFoundError if user doesn't exist
 */
export async function getUser(
  userId: string,
  requestingUserId: string
): Promise<User> {
  const client = await pool.connect();

  try {
    // Get requesting user's role
    const requestingUserResult = await client.query(
      'SELECT role FROM users WHERE id = $1',
      [requestingUserId]
    );

    if (requestingUserResult.rows.length === 0) {
      throw new NotFoundError('Requesting user');
    }

    const requestingUserRole = requestingUserResult.rows[0].role;

    // Check access control: users can view their own profile, admins can view all
    if (userId !== requestingUserId && requestingUserRole !== 'Admin') {
      throw new AuthorizationError('You can only view your own profile');
    }

    // Get user
    const result = await client.query(
      `SELECT id, email, role, first_name, last_name, is_active, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('User');
    }

    const user = result.rows[0];

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      isActive: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      error instanceof NotFoundError
    ) {
      throw error;
    }
    logger.error('Get user failed', { error, userId });
    throw new DatabaseError('Failed to retrieve user');
  } finally {
    client.release();
  }
}

/**
 * List all users
 * Only admins can list all users
 * @param requestingUserId - ID of user making the request
 * @param filters - Optional filters (role, isActive)
 * @returns Array of users
 * @throws AuthorizationError if requesting user is not admin
 */
export async function listUsers(
  requestingUserId: string,
  filters?: { role?: UserRole; isActive?: boolean }
): Promise<User[]> {
  // Check admin permission
  await requireAdminRole(requestingUserId);

  const client = await pool.connect();

  try {
    // Build query with filters
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.role) {
      if (!isValidRole(filters.role)) {
        throw new ValidationError('Invalid role filter');
      }
      conditions.push(`role = $${paramIndex++}`);
      values.push(filters.role);
    }

    if (filters?.isActive !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      values.push(filters.isActive);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT id, email, role, first_name, last_name, is_active, created_at, updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const result = await client.query(query, values);

    return result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      firstName: row.first_name,
      lastName: row.last_name,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof AuthorizationError
    ) {
      throw error;
    }
    logger.error('List users failed', { error });
    throw new DatabaseError('Failed to list users');
  } finally {
    client.release();
  }
}
