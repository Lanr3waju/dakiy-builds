import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands: any = undefined;

/**
 * Migration: Create projects and team assignments tables
 * 
 * This migration creates:
 * 1. project_role enum type (Owner, Manager, Member, Viewer)
 * 2. projects table with metadata (name, location, budget, deadlines)
 * 3. project_team_members junction table for many-to-many relationship
 * 4. Foreign key constraints and indexes for efficient queries
 * 
 * Requirements validated: 2.1, 2.5, 2.6
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create project_role enum for team member roles
  pgm.createType('project_role', ['Owner', 'Manager', 'Member', 'Viewer']);

  // Create projects table
  pgm.createTable('projects', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    description: {
      type: 'text',
      notNull: false,
    },
    location: {
      type: 'varchar(255)',
      notNull: true,
    },
    budget: {
      type: 'decimal(15, 2)',
      notNull: false,
      comment: 'Project budget in currency units',
    },
    start_date: {
      type: 'date',
      notNull: true,
    },
    end_date: {
      type: 'date',
      notNull: false,
      comment: 'Actual or current end date',
    },
    planned_completion_date: {
      type: 'date',
      notNull: true,
      comment: 'Originally planned completion date',
    },
    owner_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
      comment: 'User who created the project',
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
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

  // Create trigger to auto-update updated_at for projects
  pgm.createTrigger('projects', 'update_projects_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at_column',
    level: 'ROW',
  });

  // Create indexes for projects table
  pgm.createIndex('projects', 'owner_id', {
    name: 'idx_projects_owner_id',
  });

  pgm.createIndex('projects', 'is_active', {
    name: 'idx_projects_is_active',
  });

  pgm.createIndex('projects', 'start_date', {
    name: 'idx_projects_start_date',
  });

  pgm.createIndex('projects', 'planned_completion_date', {
    name: 'idx_projects_planned_completion_date',
  });

  // Create index for name search (case-insensitive)
  pgm.createIndex('projects', 'name', {
    name: 'idx_projects_name',
    method: 'btree',
  });

  // Create project_team_members junction table
  pgm.createTable('project_team_members', {
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
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    role: {
      type: 'project_role',
      notNull: true,
      default: 'Member',
    },
    assigned_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    assigned_by: {
      type: 'uuid',
      notNull: false,
      references: 'users',
      onDelete: 'SET NULL',
      comment: 'User who assigned this team member',
    },
  });

  // Create unique constraint to prevent duplicate assignments
  pgm.addConstraint('project_team_members', 'unique_project_user', {
    unique: ['project_id', 'user_id'],
  });

  // Create indexes for project_team_members table
  pgm.createIndex('project_team_members', 'project_id', {
    name: 'idx_project_team_members_project_id',
  });

  pgm.createIndex('project_team_members', 'user_id', {
    name: 'idx_project_team_members_user_id',
  });

  pgm.createIndex('project_team_members', 'role', {
    name: 'idx_project_team_members_role',
  });

  // Add comments to tables
  pgm.sql(`
    COMMENT ON TABLE projects IS 'Construction projects with metadata and deadlines';
    COMMENT ON TABLE project_team_members IS 'Junction table for project team assignments with roles';
    COMMENT ON TYPE project_role IS 'Project team member roles: Owner, Manager, Member, Viewer';
    COMMENT ON COLUMN projects.owner_id IS 'User who created the project';
    COMMENT ON COLUMN projects.budget IS 'Project budget in currency units';
    COMMENT ON COLUMN projects.end_date IS 'Actual or current end date';
    COMMENT ON COLUMN projects.planned_completion_date IS 'Originally planned completion date';
    COMMENT ON COLUMN project_team_members.assigned_by IS 'User who assigned this team member';
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop project_team_members table first (has foreign keys to projects)
  pgm.dropTable('project_team_members', { cascade: true });

  // Drop projects table
  pgm.dropTable('projects', { cascade: true });

  // Drop project_role enum
  pgm.dropType('project_role');
}
