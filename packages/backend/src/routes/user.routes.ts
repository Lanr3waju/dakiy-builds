import { Router, Response } from 'express';
import {
  createUser,
  updateUser,
  deleteUser,
  getUser,
  listUsers,
  CreateUserDTO,
  UpdateUserDTO,
  UserRole,
} from '../services/user.service';
import { authenticate, requireAdmin, requireAuthenticated, AuthenticatedRequest } from '../middleware/auth.middleware';
import { ValidationError } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/users/profile
 * Get current user's profile (Authenticated users)
 */
router.get(
  '/profile',
  requireAuthenticated,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = await getUser(req.user!.id, req.user!.id);

    res.status(200).json({
      success: true,
      data: user,
    });
  })
);

/**
 * PUT /api/users/profile
 * Update current user's profile (Authenticated users)
 * Users can only update their own first_name and last_name
 */
router.put(
  '/profile',
  requireAuthenticated,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { first_name, last_name } = req.body;

    const updateDTO: UpdateUserDTO = {};
    if (first_name !== undefined) updateDTO.firstName = first_name;
    if (last_name !== undefined) updateDTO.lastName = last_name;

    const updatedUser = await updateUser(req.user!.id, updateDTO, req.user!.id);

    logger.info('User profile updated', { userId: req.user!.id });

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  })
);

// All other user management routes require admin role
router.use(authenticate);
router.use(requireAdmin);

/**
 * GET /api/users
 * List all users with optional filtering (Admin only)
 * IMPORTANT: This must come BEFORE /api/users/:id to avoid route conflicts
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { role, isActive } = req.query;

    // Parse query parameters
    const filters: {
      role?: UserRole;
      isActive?: boolean;
    } = {};

    if (role) {
      const validRoles: UserRole[] = ['Admin', 'Project_Manager', 'Team_Member'];
      if (!validRoles.includes(role as UserRole)) {
        throw new ValidationError(`Invalid role filter. Must be one of: ${validRoles.join(', ')}`);
      }
      filters.role = role as UserRole;
    }

    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }

    const users = await listUsers(req.user!.id, filters);

    res.status(200).json({
      success: true,
      data: users,
      count: users.length,
    });
  })
);

/**
 * POST /api/users
 * Create a new user (Admin only)
 */
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email, password, role, firstName, lastName } = req.body;

    if (!email || !password || !role || !firstName || !lastName) {
      throw new ValidationError('Email, password, role, firstName, and lastName are required');
    }

    // Validate role
    const validRoles: UserRole[] = ['Admin', 'Project_Manager', 'Team_Member'];
    if (!validRoles.includes(role)) {
      throw new ValidationError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    const userDTO: CreateUserDTO = {
      email,
      password,
      role,
      firstName,
      lastName,
    };

    const newUser = await createUser(userDTO, req.user!.id);

    logger.info('User created', { userId: newUser.id, createdBy: req.user!.id });

    res.status(201).json({
      success: true,
      data: newUser,
    });
  })
);

/**
 * PUT /api/users/:id
 * Update an existing user (Admin only)
 */
router.put(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { email, role, firstName, lastName, isActive } = req.body;

    if (!id) {
      throw new ValidationError('User ID is required');
    }

    // Validate role if provided
    if (role) {
      const validRoles: UserRole[] = ['Admin', 'Project_Manager', 'Team_Member'];
      if (!validRoles.includes(role)) {
        throw new ValidationError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
      }
    }

    const updateDTO: UpdateUserDTO = {};
    if (email !== undefined) updateDTO.email = email;
    if (role !== undefined) updateDTO.role = role;
    if (firstName !== undefined) updateDTO.firstName = firstName;
    if (lastName !== undefined) updateDTO.lastName = lastName;
    if (isActive !== undefined) updateDTO.isActive = isActive;

    const updatedUser = await updateUser(id, updateDTO, req.user!.id);

    logger.info('User updated', { userId: id, updatedBy: req.user!.id });

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  })
);

/**
 * DELETE /api/users/:id
 * Delete a user (Admin only)
 */
router.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('User ID is required');
    }

    await deleteUser(id, req.user!.id);

    logger.info('User deleted', { userId: id, deletedBy: req.user!.id });

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  })
);

/**
 * GET /api/users/:id
 * Get user details (Admin only)
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('User ID is required');
    }

    const user = await getUser(id, req.user!.id);

    res.status(200).json({
      success: true,
      data: user,
    });
  })
);

export default router;
