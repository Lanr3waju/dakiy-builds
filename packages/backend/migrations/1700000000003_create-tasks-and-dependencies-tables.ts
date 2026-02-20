import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands: any = undefined;

/**
 * Migration: Create tasks and dependencies tables
 * 
 * This migration creates:
 * 1. tasks table with phase, duration, progress, and assignments
 * 2. task_dependencies table for dependency relationships
 * 3. Constraints to prevent self-dependencies
 * 4. Indexes for project and dependency lookups
 * 
 * Requirements validated: 3.1, 3.2, 3.4
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create tasks table
  pgm.createTable('tasks', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    project_id: {
      type: 'uuid',
      notNull: true,
      references: 'projects',
      onDelete: 'CASCADE',
      comment: 'Project this task belongs to',
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    description: {
      type: 'text',
      notNull: false,
    },
    phase: {
      type: 'varchar(100)',
      notNull: true,
      comment: 'Construction phase (e.g., Foundation, Framing, Finishing)',
    },
    estimated_duration_days: {
      type: 'integer',
      notNull: true,
      comment: 'Estimated duration in working days',
    },
    actual_duration_days: {
      type: 'integer',
      notNull: false,
      comment: 'Actual duration in working days (set when completed)',
    },
    progress_percentage: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Progress percentage (0-100)',
    },
    is_completed: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    completed_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'Timestamp when task was marked complete',
    },
    assigned_to: {
      type: 'uuid',
      notNull: false,
      references: 'users',
      onDelete: 'SET NULL',
      comment: 'User assigned to this task',
    },
    created_by: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
      comment: 'User who created this task',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Add constraint to ensure progress is between 0 and 100
  pgm.addConstraint('tasks', 'check_progress_range', {
    check: 'progress_percentage >= 0 AND progress_percentage <= 100',
  });

  // Add constraint to ensure estimated_duration_days is positive
  pgm.addConstraint('tasks', 'check_estimated_duration_positive', {
    check: 'estimated_duration_days > 0',
  });

  // Add constraint to ensure actual_duration_days is positive when set
  pgm.addConstraint('tasks', 'check_actual_duration_positive', {
    check: 'actual_duration_days IS NULL OR actual_duration_days > 0',
  });

  // Create trigger to auto-update updated_at for tasks
  pgm.createTrigger('tasks', 'update_tasks_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at_column',
    level: 'ROW',
  });

  // Create indexes for tasks table
  pgm.createIndex('tasks', 'project_id', {
    name: 'idx_tasks_project_id',
  });

  pgm.createIndex('tasks', 'assigned_to', {
    name: 'idx_tasks_assigned_to',
  });

  pgm.createIndex('tasks', 'phase', {
    name: 'idx_tasks_phase',
  });

  pgm.createIndex('tasks', 'is_completed', {
    name: 'idx_tasks_is_completed',
  });

  // Composite index for project tasks queries
  pgm.createIndex('tasks', ['project_id', 'phase'], {
    name: 'idx_tasks_project_phase',
  });

  // Composite index for user task assignments
  pgm.createIndex('tasks', ['assigned_to', 'is_completed'], {
    name: 'idx_tasks_assigned_completed',
  });

  // Create task_dependencies table
  pgm.createTable('task_dependencies', {
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
      comment: 'Task that depends on another task',
    },
    depends_on_task_id: {
      type: 'uuid',
      notNull: true,
      references: 'tasks',
      onDelete: 'CASCADE',
      comment: 'Task that must be completed first',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    created_by: {
      type: 'uuid',
      notNull: false,
      references: 'users',
      onDelete: 'SET NULL',
      comment: 'User who created this dependency',
    },
  });

  // Add constraint to prevent self-dependencies
  pgm.addConstraint('task_dependencies', 'check_no_self_dependency', {
    check: 'task_id != depends_on_task_id',
  });

  // Create unique constraint to prevent duplicate dependencies
  pgm.addConstraint('task_dependencies', 'unique_task_dependency', {
    unique: ['task_id', 'depends_on_task_id'],
  });

  // Create indexes for task_dependencies table
  pgm.createIndex('task_dependencies', 'task_id', {
    name: 'idx_task_dependencies_task_id',
  });

  pgm.createIndex('task_dependencies', 'depends_on_task_id', {
    name: 'idx_task_dependencies_depends_on_task_id',
  });

  // Add comments to tables and columns
  pgm.sql(`
    COMMENT ON TABLE tasks IS 'Construction tasks with phases, durations, and progress tracking';
    COMMENT ON TABLE task_dependencies IS 'Task dependency relationships (task A depends on task B)';
    COMMENT ON COLUMN tasks.project_id IS 'Project this task belongs to';
    COMMENT ON COLUMN tasks.phase IS 'Construction phase (e.g., Foundation, Framing, Finishing)';
    COMMENT ON COLUMN tasks.estimated_duration_days IS 'Estimated duration in working days';
    COMMENT ON COLUMN tasks.actual_duration_days IS 'Actual duration in working days (set when completed)';
    COMMENT ON COLUMN tasks.progress_percentage IS 'Progress percentage (0-100)';
    COMMENT ON COLUMN tasks.completed_at IS 'Timestamp when task was marked complete';
    COMMENT ON COLUMN tasks.assigned_to IS 'User assigned to this task';
    COMMENT ON COLUMN tasks.created_by IS 'User who created this task';
    COMMENT ON COLUMN task_dependencies.task_id IS 'Task that depends on another task';
    COMMENT ON COLUMN task_dependencies.depends_on_task_id IS 'Task that must be completed first';
    COMMENT ON COLUMN task_dependencies.created_by IS 'User who created this dependency';
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop task_dependencies table first (has foreign keys to tasks)
  pgm.dropTable('task_dependencies', { cascade: true });

  // Drop tasks table
  pgm.dropTable('tasks', { cascade: true });
}
