/**
 * Example usage of authorization middleware
 * This file demonstrates how to use the auth middleware in Express routes
 */

import express, { Request, Response } from 'express';
import {
  authenticate,
  requireAdmin,
  requireProjectManager,
  requireAuthenticated,
  optionalAuthenticate,
  AuthenticatedRequest,
} from './auth.middleware';
import { errorHandler, notFoundHandler } from './errorHandler';

const app = express();

// Middleware setup
app.use(express.json());

// ============================================================================
// Public Routes (No Authentication Required)
// ============================================================================

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================================
// Optional Authentication Routes
// ============================================================================

app.get('/api/public/projects', optionalAuthenticate, (req: AuthenticatedRequest, res: Response) => {
  if (req.user) {
    // Authenticated user - show all projects they have access to
    res.json({
      message: 'Showing user-specific projects',
      userId: req.user.id,
      role: req.user.role,
    });
  } else {
    // Anonymous user - show only public projects
    res.json({
      message: 'Showing public projects only',
    });
  }
});

// ============================================================================
// Authenticated Routes (Any Role)
// ============================================================================

app.get('/api/profile', authenticate, requireAuthenticated, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    user: req.user,
    session: {
      id: req.session?.id,
      expiresAt: req.session?.expiresAt,
    },
  });
});

app.get('/api/dashboard', authenticate, requireAuthenticated, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    message: 'Dashboard data',
    userId: req.user?.id,
    role: req.user?.role,
  });
});

// ============================================================================
// Project Manager or Admin Routes
// ============================================================================

app.post('/api/projects', authenticate, requireProjectManager, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    message: 'Project created',
    createdBy: req.user?.id,
    role: req.user?.role,
  });
});

app.put('/api/projects/:id', authenticate, requireProjectManager, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    message: `Project ${req.params.id} updated`,
    updatedBy: req.user?.id,
  });
});

app.delete('/api/projects/:id', authenticate, requireProjectManager, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    message: `Project ${req.params.id} deleted`,
    deletedBy: req.user?.id,
  });
});

app.post('/api/projects/:id/team', authenticate, requireProjectManager, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    message: 'Team member assigned',
    projectId: req.params.id,
    assignedBy: req.user?.id,
  });
});

// ============================================================================
// Admin Only Routes
// ============================================================================

app.post('/api/users', authenticate, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    message: 'User created',
    createdBy: req.user?.id,
  });
});

app.put('/api/users/:id', authenticate, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    message: `User ${req.params.id} updated`,
    updatedBy: req.user?.id,
  });
});

app.delete('/api/users/:id', authenticate, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    message: `User ${req.params.id} deleted`,
    deletedBy: req.user?.id,
  });
});

app.get('/api/admin/audit-logs', authenticate, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    message: 'Audit logs',
    requestedBy: req.user?.id,
  });
});

app.post('/api/admin/holidays', authenticate, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    message: 'Holiday configured',
    configuredBy: req.user?.id,
  });
});

// ============================================================================
// Team Member Routes (Can also be accessed by PM and Admin)
// ============================================================================

app.post('/api/tasks/:id/progress', authenticate, requireAuthenticated, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    message: `Progress updated for task ${req.params.id}`,
    updatedBy: req.user?.id,
    role: req.user?.role,
  });
});

app.get('/api/projects/:id', authenticate, requireAuthenticated, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    message: `Project ${req.params.id} details`,
    requestedBy: req.user?.id,
    role: req.user?.role,
  });
});

// ============================================================================
// Error Handling
// ============================================================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================================
// Export for testing or integration
// ============================================================================

export default app;

/**
 * Example Request Flow:
 * 
 * 1. Client sends request with Authorization header:
 *    Authorization: Bearer <session-token>
 * 
 * 2. authenticate middleware:
 *    - Extracts token from header or cookie
 *    - Validates session with auth service
 *    - Attaches user and session to req object
 *    - Calls next() if successful
 *    - Throws AuthenticationError if failed
 * 
 * 3. requireRole middleware:
 *    - Checks if req.user exists
 *    - Verifies user has required role
 *    - Calls next() if authorized
 *    - Throws AuthorizationError if not authorized
 * 
 * 4. Route handler:
 *    - Accesses req.user and req.session
 *    - Performs business logic
 *    - Returns response
 * 
 * 5. Error handler (if error thrown):
 *    - Catches AuthenticationError (401)
 *    - Catches AuthorizationError (403)
 *    - Returns appropriate error response
 */
