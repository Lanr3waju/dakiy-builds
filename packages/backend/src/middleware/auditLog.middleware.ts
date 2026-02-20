import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AuthenticatedRequest } from './auth.middleware';
import logger from '../utils/logger';

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  entityType: string;
  entityId: string | null;
  userId: string;
  action: string;
  details: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry in the database
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, user_id, action, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.entityType,
        entry.entityId,
        entry.userId,
        entry.action,
        JSON.stringify(entry.details),
        entry.ipAddress || null,
        entry.userAgent || null,
      ]
    );

    logger.info('Audit log created', {
      entityType: entry.entityType,
      entityId: entry.entityId,
      userId: entry.userId,
      action: entry.action,
    });
  } catch (error) {
    // Log error but don't fail the request
    logger.error('Failed to create audit log', { error, entry });
  }
}

/**
 * Extract entity information from request
 */
function extractEntityInfo(req: Request): { entityType: string; entityId: string | null } {
  const path = req.path;

  // Determine entity type from path
  if (path.includes('/projects')) {
    return {
      entityType: 'project',
      entityId: req.params.id || req.params.projectId || null,
    };
  } else if (path.includes('/tasks')) {
    return {
      entityType: 'task',
      entityId: req.params.id || req.params.taskId || null,
    };
  } else if (path.includes('/documents')) {
    return {
      entityType: 'document',
      entityId: req.params.id || null,
    };
  } else if (path.includes('/users')) {
    return {
      entityType: 'user',
      entityId: req.params.id || null,
    };
  } else if (path.includes('/auth')) {
    return {
      entityType: 'auth',
      entityId: null,
    };
  } else if (path.includes('/admin/holidays')) {
    return {
      entityType: 'holiday',
      entityId: req.params.id || null,
    };
  }

  return {
    entityType: 'unknown',
    entityId: null,
  };
}

/**
 * Determine action from request method and path
 */
function determineAction(req: Request): string {
  const method = req.method;
  const path = req.path;

  // Authentication actions
  if (path.includes('/auth/login')) return 'login';
  if (path.includes('/auth/logout')) return 'logout';

  // Standard CRUD actions
  if (method === 'POST' && !path.includes('/progress') && !path.includes('/dependencies') && !path.includes('/team') && !path.includes('/tags') && !path.includes('/link')) {
    return 'create';
  }
  if (method === 'PUT' || method === 'PATCH') return 'update';
  if (method === 'DELETE') return 'delete';

  // Special actions
  if (path.includes('/progress')) return 'update_progress';
  if (path.includes('/dependencies')) {
    return method === 'POST' ? 'add_dependency' : 'remove_dependency';
  }
  if (path.includes('/team')) {
    return method === 'POST' ? 'assign_team_member' : 'remove_team_member';
  }
  if (path.includes('/tags')) return 'add_tags';
  if (path.includes('/link')) return 'link_document';
  if (path.includes('/versions')) return 'upload_version';
  if (path.includes('/forecast')) return 'generate_forecast';
  if (path.includes('/holidays')) {
    if (method === 'POST') return 'configure_holidays';
    if (method === 'DELETE') return 'delete_holiday';
  }

  return method.toLowerCase();
}

/**
 * Check if the request should be audited
 */
function shouldAudit(req: Request): boolean {
  const method = req.method;
  const path = req.path;

  // Don't audit GET requests (read operations)
  if (method === 'GET') return false;

  // Don't audit health checks or static files
  if (path.includes('/health') || path.includes('/static')) return false;

  // Audit all other write operations
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

/**
 * Audit logging middleware
 * Logs significant user actions to the audit_logs table
 */
export function auditLog() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only audit if user is authenticated and action should be audited
    const authReq = req as AuthenticatedRequest;
    
    if (!authReq.user || !shouldAudit(req)) {
      return next();
    }

    // Store original send function
    const originalSend = res.send;

    // Override send to capture response
    res.send = function (data: any): Response {
      // Only log if request was successful (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const { entityType, entityId } = extractEntityInfo(req);
        const action = determineAction(req);

        // Create audit log entry (async, don't wait)
        createAuditLog({
          entityType,
          entityId,
          userId: authReq.user!.id,
          action,
          details: {
            method: req.method,
            path: req.path,
            body: sanitizeBody(req.body),
            statusCode: res.statusCode,
          },
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.get('user-agent'),
        }).catch((error) => {
          logger.error('Audit log creation failed', { error });
        });
      }

      // Call original send
      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Sanitize request body to remove sensitive information
 */
function sanitizeBody(body: any): any {
  if (!body) return {};

  const sanitized = { ...body };

  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'accessToken', 'refreshToken'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Log authentication attempts (both successful and failed)
 */
export async function logAuthAttempt(
  username: string,
  success: boolean,
  userId: string | null,
  ipAddress: string | undefined,
  userAgent: string | undefined,
  reason?: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, user_id, action, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        'auth',
        null,
        userId,
        success ? 'login_success' : 'login_failed',
        JSON.stringify({
          username,
          success,
          reason: reason || (success ? 'Valid credentials' : 'Invalid credentials'),
        }),
        ipAddress || null,
        userAgent || null,
      ]
    );

    logger.info('Auth attempt logged', { username, success, userId });
  } catch (error) {
    logger.error('Failed to log auth attempt', { error, username });
  }
}

/**
 * Log authorization failures
 */
export async function logAuthorizationFailure(
  userId: string,
  action: string,
  resource: string,
  reason: string,
  ipAddress: string | undefined,
  userAgent: string | undefined
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, user_id, action, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        'authorization',
        null,
        userId,
        'access_denied',
        JSON.stringify({
          action,
          resource,
          reason,
        }),
        ipAddress || null,
        userAgent || null,
      ]
    );

    logger.warn('Authorization failure logged', { userId, action, resource, reason });
  } catch (error) {
    logger.error('Failed to log authorization failure', { error, userId });
  }
}
