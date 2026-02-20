import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { AppError, ValidationError } from '../utils/errors';

interface Holiday {
  id?: string;
  region: string;
  date: Date;
  name: string;
  is_recurring: boolean;
  created_at?: Date;
}

interface NonWorkingDay {
  date: Date;
  reason: string; // 'weekend' | 'holiday'
  holidayName?: string;
}

/**
 * Calendar Service
 * 
 * Manages holidays and non-working days for project scheduling.
 * Supports region-specific holiday calendars and weekend calculations.
 */
export class CalendarService {
  /**
   * Get non-working days for a date range
   * Includes weekends and region-specific holidays
   * 
   * @param startDate - Start date of range
   * @param endDate - End date of range
   * @param region - Region for holiday calendar (optional)
   * @returns Array of non-working days with reasons
   */
  async getNonWorkingDays(
    startDate: Date,
    endDate: Date,
    region?: string
  ): Promise<NonWorkingDay[]> {
    const nonWorkingDays: NonWorkingDay[] = [];
    
    // Get holidays for the region
    const holidays = region 
      ? await this.getHolidaysForRegion(region, startDate, endDate)
      : [];
    
    // Create a map of holiday dates for quick lookup
    const holidayMap = new Map<string, Holiday>();
    holidays.forEach(holiday => {
      const dateKey = holiday.date.toISOString().split('T')[0];
      holidayMap.set(dateKey, holiday);
    });
    
    // Iterate through date range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay();
      
      // Check if it's a weekend (Saturday = 6, Sunday = 0)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        nonWorkingDays.push({
          date: new Date(currentDate),
          reason: 'weekend',
        });
      }
      // Check if it's a holiday
      else if (holidayMap.has(dateKey)) {
        const holiday = holidayMap.get(dateKey)!;
        nonWorkingDays.push({
          date: new Date(currentDate),
          reason: 'holiday',
          holidayName: holiday.name,
        });
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    logger.info(`Found ${nonWorkingDays.length} non-working days between ${startDate.toISOString().split('T')[0]} and ${endDate.toISOString().split('T')[0]}`);
    
    return nonWorkingDays;
  }

  /**
   * Get holidays for a specific region and date range
   * 
   * @param region - Region identifier
   * @param startDate - Start date of range
   * @param endDate - End date of range
   * @returns Array of holidays
   */
  async getHolidaysForRegion(
    region: string,
    startDate: Date,
    endDate: Date
  ): Promise<Holiday[]> {
    const client = await pool.connect();
    
    try {
      const { rows } = await client.query(
        `SELECT id, region, date, name, is_recurring, created_at
         FROM holidays
         WHERE region = $1
         AND date BETWEEN $2 AND $3
         ORDER BY date ASC`,
        [region, startDate, endDate]
      );
      
      return rows.map((r: any) => ({
        id: r.id,
        region: r.region,
        date: r.date,
        name: r.name,
        is_recurring: r.is_recurring,
        created_at: r.created_at,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Configure holidays for a region (Admin only)
   * 
   * @param region - Region identifier
   * @param holidays - Array of holidays to configure
   * @param userId - ID of user performing the action
   * @returns Array of created holiday IDs
   */
  async configureHolidays(
    region: string,
    holidays: Omit<Holiday, 'id' | 'created_at'>[],
    userId: string
  ): Promise<string[]> {
    // Validate input
    if (!region || region.trim().length === 0) {
      throw new ValidationError('Region is required');
    }
    
    if (!holidays || holidays.length === 0) {
      throw new ValidationError('At least one holiday must be provided');
    }
    
    // Validate each holiday
    for (const holiday of holidays) {
      if (!holiday.name || holiday.name.trim().length === 0) {
        throw new ValidationError('Holiday name is required');
      }
      if (!holiday.date) {
        throw new ValidationError('Holiday date is required');
      }
    }
    
    const client = await pool.connect();
    const holidayIds: string[] = [];
    
    try {
      await client.query('BEGIN');
      
      for (const holiday of holidays) {
        // Insert or update holiday
        const { rows } = await client.query(
          `INSERT INTO holidays (region, date, name, is_recurring, created_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT (region, date)
           DO UPDATE SET
             name = EXCLUDED.name,
             is_recurring = EXCLUDED.is_recurring,
             created_at = CURRENT_TIMESTAMP
           RETURNING id`,
          [region, holiday.date, holiday.name, holiday.is_recurring]
        );
        
        holidayIds.push(rows[0].id);
      }
      
      // Log the configuration action
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          userId,
          'configure_holidays',
          'holidays',
          region,
          JSON.stringify({ region, count: holidays.length }),
        ]
      );
      
      await client.query('COMMIT');
      logger.info(`Configured ${holidays.length} holidays for region ${region}`);
      
      return holidayIds;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error configuring holidays:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all configured holidays for a region
   * 
   * @param region - Region identifier
   * @returns Array of all holidays for the region
   */
  async getAllHolidaysForRegion(region: string): Promise<Holiday[]> {
    const client = await pool.connect();
    
    try {
      const { rows } = await client.query(
        `SELECT id, region, date, name, is_recurring, created_at
         FROM holidays
         WHERE region = $1
         ORDER BY date ASC`,
        [region]
      );
      
      return rows.map((r: any) => ({
        id: r.id,
        region: r.region,
        date: r.date,
        name: r.name,
        is_recurring: r.is_recurring,
        created_at: r.created_at,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Delete a holiday
   * 
   * @param holidayId - ID of holiday to delete
   * @param userId - ID of user performing the action
   */
  async deleteHoliday(holidayId: string, userId: string): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get holiday details before deletion
      const { rows } = await client.query(
        'SELECT region, date, name FROM holidays WHERE id = $1',
        [holidayId]
      );
      
      if (rows.length === 0) {
        throw new AppError('Holiday not found', 404);
      }
      
      const holiday = rows[0];
      
      // Delete the holiday
      await client.query('DELETE FROM holidays WHERE id = $1', [holidayId]);
      
      // Log the deletion
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          userId,
          'delete_holiday',
          'holidays',
          holidayId,
          JSON.stringify({ region: holiday.region, date: holiday.date, name: holiday.name }),
        ]
      );
      
      await client.query('COMMIT');
      logger.info(`Deleted holiday ${holidayId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error deleting holiday:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Calculate working days between two dates
   * Excludes weekends and holidays
   * 
   * @param startDate - Start date
   * @param endDate - End date
   * @param region - Region for holiday calendar (optional)
   * @returns Number of working days
   */
  async calculateWorkingDays(
    startDate: Date,
    endDate: Date,
    region?: string
  ): Promise<number> {
    const nonWorkingDays = await this.getNonWorkingDays(startDate, endDate, region);
    
    // Calculate total days
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Subtract non-working days
    const workingDays = totalDays - nonWorkingDays.length;
    
    return Math.max(0, workingDays);
  }

  /**
   * Add working days to a start date
   * Skips weekends and holidays
   * 
   * @param startDate - Start date
   * @param workingDays - Number of working days to add
   * @param region - Region for holiday calendar (optional)
   * @returns End date after adding working days
   */
  async addWorkingDays(
    startDate: Date,
    workingDays: number,
    region?: string
  ): Promise<Date> {
    if (workingDays < 0) {
      throw new ValidationError('Working days must be non-negative');
    }
    
    if (workingDays === 0) {
      return new Date(startDate);
    }
    
    // Estimate end date (assuming ~70% working days)
    const estimatedEndDate = new Date(startDate);
    estimatedEndDate.setDate(estimatedEndDate.getDate() + Math.ceil(workingDays * 1.4));
    
    // Get non-working days for the estimated range
    const nonWorkingDays = await this.getNonWorkingDays(startDate, estimatedEndDate, region);
    const nonWorkingSet = new Set(
      nonWorkingDays.map(d => d.date.toISOString().split('T')[0])
    );
    
    // Count working days
    let currentDate = new Date(startDate);
    let remainingWorkingDays = workingDays;
    
    while (remainingWorkingDays > 0) {
      currentDate.setDate(currentDate.getDate() + 1);
      const dateKey = currentDate.toISOString().split('T')[0];
      
      if (!nonWorkingSet.has(dateKey)) {
        remainingWorkingDays--;
      }
    }
    
    return currentDate;
  }

  /**
   * Get list of all configured regions
   * 
   * @returns Array of unique region identifiers
   */
  async getConfiguredRegions(): Promise<string[]> {
    const client = await pool.connect();
    
    try {
      const { rows } = await client.query(
        'SELECT DISTINCT region FROM holidays ORDER BY region ASC'
      );
      
      return rows.map((r: any) => r.region);
    } finally {
      client.release();
    }
  }
}

// Export singleton instance
export const calendarService = new CalendarService();
