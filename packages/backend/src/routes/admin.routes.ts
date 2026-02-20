import { Router, Response } from 'express';
import { pool } from '../config/database';
import { calendarService } from '../services/calendar.service';
import {
  authenticate,
  requireAdmin,
  AuthenticatedRequest,
} from '../middleware/auth.middleware';
import { ValidationError } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

/**
 * POST /api/admin/holidays
 * Configure holidays for a region
 */
router.post(
  '/holidays',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { region, holidays } = req.body;

    if (!region || typeof region !== 'string') {
      throw new ValidationError('Region is required and must be a string');
    }

    if (!holidays || !Array.isArray(holidays) || holidays.length === 0) {
      throw new ValidationError('Holidays array is required and must not be empty');
    }

    // Validate holiday structure
    for (const holiday of holidays) {
      if (!holiday.name || !holiday.date) {
        throw new ValidationError('Each holiday must have a name and date');
      }
    }

    await calendarService.configureHolidays(region, holidays, req.user!.id);

    logger.info('Holidays configured', { region, count: holidays.length, configuredBy: req.user!.id });

    res.status(200).json({
      success: true,
      message: 'Holidays configured successfully',
    });
  })
);

/**
 * GET /api/admin/holidays
 * List configured holidays
 */
router.get(
  '/holidays',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { region } = req.query;

    if (region && typeof region === 'string') {
      // Get holidays for specific region
      const holidays = await calendarService.getAllHolidaysForRegion(region);

      res.status(200).json({
        success: true,
        data: holidays,
        count: holidays.length,
      });
    } else {
      // Get all configured regions
      const regions = await calendarService.getConfiguredRegions();

      res.status(200).json({
        success: true,
        data: regions,
        count: regions.length,
      });
    }
  })
);

/**
 * DELETE /api/admin/holidays/:id
 * Delete a holiday
 */
router.delete(
  '/holidays/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('Holiday ID is required');
    }

    await calendarService.deleteHoliday(id, req.user!.id);

    logger.info('Holiday deleted', { holidayId: id, deletedBy: req.user!.id });

    res.status(200).json({
      success: true,
      message: 'Holiday deleted successfully',
    });
  })
);

export default router;

/**
 * GET /api/admin/audit-logs
 * Retrieve audit logs with filtering
 */
router.get(
  '/audit-logs',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { entityType, entityId, userId, action, startDate, endDate, limit, offset } = req.query;

    // Build query dynamically based on filters
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (entityType && typeof entityType === 'string') {
      conditions.push(`entity_type = $${paramIndex++}`);
      values.push(entityType);
    }

    if (entityId && typeof entityId === 'string') {
      conditions.push(`entity_id = $${paramIndex++}`);
      values.push(entityId);
    }

    if (userId && typeof userId === 'string') {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(userId);
    }

    if (action && typeof action === 'string') {
      conditions.push(`action = $${paramIndex++}`);
      values.push(action);
    }

    if (startDate && typeof startDate === 'string') {
      conditions.push(`created_at >= $${paramIndex++}`);
      values.push(new Date(startDate));
    }

    if (endDate && typeof endDate === 'string') {
      conditions.push(`created_at <= $${paramIndex++}`);
      values.push(new Date(endDate));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Parse limit and offset
    const limitValue = limit && typeof limit === 'string' ? parseInt(limit) : 100;
    const offsetValue = offset && typeof offset === 'string' ? parseInt(offset) : 0;

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
      values
    );

    const total = parseInt(countResult.rows[0].total);

    // Get audit logs with pagination
    const logsResult = await pool.query(
      `SELECT 
        al.id,
        al.entity_type,
        al.entity_id,
        al.user_id,
        al.action,
        al.details,
        al.created_at,
        u.first_name,
        u.last_name,
        u.email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limitValue, offsetValue]
    );

    logger.info('Audit logs retrieved', { 
      filters: { entityType, entityId, userId, action, startDate, endDate },
      count: logsResult.rows.length,
      requestedBy: req.user!.id 
    });

    res.status(200).json({
      success: true,
      data: logsResult.rows,
      pagination: {
        total,
        limit: limitValue,
        offset: offsetValue,
        hasMore: offsetValue + logsResult.rows.length < total,
      },
    });
  })
);
