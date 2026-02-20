import { Request, Response, NextFunction } from 'express';
import { validateSession } from '../services/auth.service';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import { UserRole } from '../types';
import logger from '../utils/logger';

/**
 * Extended Express Request with authenticated user information
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    firstName: string;
    lastName: string;
  };
  session?: {
    id: string;
    token: string;
    expiresAt: Date;
  };
}

/**
 * Middleware to authenticate requests using session token
 * Validates the session token from Authorization header or cookies
 * Attaches user and session info to the request object
 * 
 * @throws AuthenticationError if token is missing, invalid, or expired
 */
export async function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header (Bearer token) or cookies
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies?.session_token) {
      token = req.cookies.session_token;
    }

    if (!token) {
      throw new AuthenticationError('Authentication token is required');
    }

    // Validate session and get user info
    const authResult = await validateSession(token);

    // Attach user and session info to request
    req.user = {
      ...authResult.user,
      role: authResult.user.role as UserRole,
    };
    req.session = {
      id: authResult.session.id,
      token: authResult.session.token,
      expiresAt: authResult.session.expiresAt,
    };

    logger.debug('Request authenticated', {
      userId: req.user.id,
      role: req.user.role,
      path: req.path,
      method: req.method,
    });

    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      logger.warn('Authentication failed', {
        path: req.path,
        method: req.method,
        error: error.message,
      });
      next(error);
    } else {
      logger.error('Authentication error', {
        path: req.path,
        method: req.method,
        error,
      });
      next(new AuthenticationError('Authentication failed'));
    }
  }
}

/**
 * Middleware factory to check if authenticated user has required role(s)
 * Must be used after authenticate middleware
 * 
 * @param allowedRoles - Array of roles that are allowed to access the route
 * @returns Express middleware function
 * @throws AuthorizationError if user doesn't have required role
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }

      // Check if user has one of the allowed roles
      const userRole = req.user.role;
      
      if (!allowedRoles.includes(userRole)) {
        logger.warn('Authorization failed - insufficient permissions', {
          userId: req.user.id,
          userRole,
          requiredRoles: allowedRoles,
          path: req.path,
          method: req.method,
        });
        
        throw new AuthorizationError(
          `Access denied. Required role: ${allowedRoles.join(' or ')}`
        );
      }

      logger.debug('Authorization successful', {
        userId: req.user.id,
        userRole,
        path: req.path,
        method: req.method,
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to check if user is an Admin
 * Convenience wrapper around requireRole
 */
export const requireAdmin = requireRole(UserRole.ADMIN);

/**
 * Middleware to check if user is a Project Manager or Admin
 * Convenience wrapper around requireRole
 */
export const requireProjectManager = requireRole(
  UserRole.ADMIN,
  UserRole.PROJECT_MANAGER
);

/**
 * Middleware to check if user is authenticated (any role)
 * Convenience wrapper around requireRole
 */
export const requireAuthenticated = requireRole(
  UserRole.ADMIN,
  UserRole.PROJECT_MANAGER,
  UserRole.TEAM_MEMBER
);

/**
 * Optional authentication middleware
 * Attempts to authenticate but doesn't fail if no token is provided
 * Useful for routes that have different behavior for authenticated vs anonymous users
 */
export async function optionalAuthenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies?.session_token) {
      token = req.cookies.session_token;
    }

    // If no token, continue without authentication
    if (!token) {
      next();
      return;
    }

    // Try to validate session
    try {
      const authResult = await validateSession(token);
      req.user = {
        ...authResult.user,
        role: authResult.user.role as UserRole,
      };
      req.session = {
        id: authResult.session.id,
        token: authResult.session.token,
        expiresAt: authResult.session.expiresAt,
      };
    } catch (error) {
      // Ignore authentication errors for optional auth
      logger.debug('Optional authentication failed', {
        path: req.path,
        method: req.method,
      });
    }

    next();
  } catch (error) {
    // Don't fail on errors for optional auth
    next();
  }
}
