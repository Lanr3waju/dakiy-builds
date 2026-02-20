import { Router, Response } from 'express';
import { login, logout, validateSession } from '../services/auth.service';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { ValidationError } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
router.post(
  '/login',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const authResult = await login({ email, password });

    logger.info('User login successful', { userId: authResult.user.id });

    res.status(200).json({
      success: true,
      data: {
        token: authResult.session.token,
        expiresAt: authResult.session.expiresAt,
        user: authResult.user,
      },
    });
  })
);

/**
 * POST /api/auth/logout
 * Destroy user session
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const token = req.session?.token;

    if (!token) {
      throw new ValidationError('Session token not found');
    }

    await logout(token);

    logger.info('User logout successful', { userId: req.user?.id });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  })
);

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    // Optionally refresh session validation
    if (req.session?.token) {
      const authResult = await validateSession(req.session.token);
      
      res.status(200).json({
        success: true,
        data: {
          user: authResult.user,
          session: {
            expiresAt: authResult.session.expiresAt,
          },
        },
      });
    } else {
      res.status(200).json({
        success: true,
        data: {
          user: req.user,
        },
      });
    }
  })
);

export default router;
