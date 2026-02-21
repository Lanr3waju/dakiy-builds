import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands: any = undefined;

/**
 * Migration: Add date-based tracking columns to tasks table
 * 
 * This migration adds:
 * 1. start_date (DATE, nullable) - Task start date
 * 2. end_date (DATE, nullable) - Task end date
 * 3. auto_progress_enabled (BOOLEAN, default true) - Enable automatic progress calculation
 * 4. Check constraint to ensure end_date >= start_date
 * 5. Index on (start_date, end_date) for performance
 * 
 * Maintains backward compatibility with existing estimated_duration_days field.
 * 
 * Requirements validated: 1.1, 2.1, Technical Requirements - Database Changes
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Add start_date column (nullable for backward compatibility)
  pgm.addColumn('tasks', {
    start_date: {
      type: 'date',
      notNull: false,
      comment: 'Task start date for date-based tracking',
    },
  });

  // Add end_date column (nullable for backward compatibility)
  pgm.addColumn('tasks', {
    end_date: {
      type: 'date',
      notNull: false,
      comment: 'Task end date for date-based tracking',
    },
  });

  // Add auto_progress_enabled column
  pgm.addColumn('tasks', {
    auto_progress_enabled: {
      type: 'boolean',
      notNull: true,
      default: true,
      comment: 'Enable automatic progress calculation based on dates',
    },
  });

  // Add check constraint to ensure end_date >= start_date
  pgm.addConstraint('tasks', 'check_date_order', {
    check: 'end_date IS NULL OR start_date IS NULL OR end_date >= start_date',
  });

  // Create index on (start_date, end_date) for performance
  // Only index rows where start_date is not null (partial index)
  pgm.createIndex('tasks', ['start_date', 'end_date'], {
    name: 'idx_tasks_dates',
    where: 'start_date IS NOT NULL',
  });

  // Add comments to new columns
  pgm.sql(`
    COMMENT ON COLUMN tasks.start_date IS 'Task start date for date-based tracking';
    COMMENT ON COLUMN tasks.end_date IS 'Task end date for date-based tracking';
    COMMENT ON COLUMN tasks.auto_progress_enabled IS 'Enable automatic progress calculation based on dates';
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop index first
  pgm.dropIndex('tasks', ['start_date', 'end_date'], {
    name: 'idx_tasks_dates',
  });

  // Drop constraint
  pgm.dropConstraint('tasks', 'check_date_order');

  // Drop columns in reverse order
  pgm.dropColumn('tasks', 'auto_progress_enabled');
  pgm.dropColumn('tasks', 'end_date');
  pgm.dropColumn('tasks', 'start_date');
}
