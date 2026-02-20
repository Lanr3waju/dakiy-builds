import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands: any = undefined;

/**
 * Migration: Create task progress history table
 * 
 * This migration creates:
 * 1. task_progress_history table with timestamp, user, percentage, and notes
 * 2. Indexes for task and timestamp lookups
 * 
 * Requirements validated: 3.5, 10.2, 10.3
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create task_progress_history table
  pgm.createTable('task_progress_history', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    task_id: {
      type: 'uuid',
      notNull: true,
      references: 'tasks',
      onDelete: 'CASCADE',
      comment: 'Task this progress update belongs to',
    },
    progress_percentage: {
      type: 'integer',
      notNull: true,
      comment: 'Progress percentage (0-100)',
    },
    notes: {
      type: 'text',
      notNull: false,
      comment: 'Optional notes about the progress update',
    },
    updated_by: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
      comment: 'User who made this progress update',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
      comment: 'Timestamp when progress was updated',
    },
  });

  // Add constraint to ensure progress is between 0 and 100
  pgm.addConstraint('task_progress_history', 'check_progress_range', {
    check: 'progress_percentage >= 0 AND progress_percentage <= 100',
  });

  // Create indexes for task_progress_history table
  pgm.createIndex('task_progress_history', 'task_id', {
    name: 'idx_task_progress_history_task_id',
  });

  pgm.createIndex('task_progress_history', 'created_at', {
    name: 'idx_task_progress_history_created_at',
  });

  pgm.createIndex('task_progress_history', 'updated_by', {
    name: 'idx_task_progress_history_updated_by',
  });

  // Composite index for task progress queries in chronological order
  pgm.createIndex('task_progress_history', ['task_id', 'created_at'], {
    name: 'idx_task_progress_history_task_created',
  });

  // Composite index for user progress updates
  pgm.createIndex('task_progress_history', ['updated_by', 'created_at'], {
    name: 'idx_task_progress_history_user_created',
  });

  // Add comments to table and columns
  pgm.sql(`
    COMMENT ON TABLE task_progress_history IS 'Historical record of all task progress updates for tracking and forecasting';
    COMMENT ON COLUMN task_progress_history.task_id IS 'Task this progress update belongs to';
    COMMENT ON COLUMN task_progress_history.progress_percentage IS 'Progress percentage (0-100)';
    COMMENT ON COLUMN task_progress_history.notes IS 'Optional notes about the progress update';
    COMMENT ON COLUMN task_progress_history.updated_by IS 'User who made this progress update';
    COMMENT ON COLUMN task_progress_history.created_at IS 'Timestamp when progress was updated';
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop task_progress_history table
  pgm.dropTable('task_progress_history', { cascade: true });
}
