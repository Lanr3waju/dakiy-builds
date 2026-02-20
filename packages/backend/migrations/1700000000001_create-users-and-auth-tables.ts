import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands: any = undefined;

/**
 * Migration: Create users and authentication tables
 * 
 * This migration creates:
 * 1. user_role enum type (Admin, Project_Manager, Team_Member)
 * 2. users table with role, email, and password fields
 * 3. sessions table for authentication tracking
 * 4. Indexes for email and session lookups
 * 
 * Requirements validated: 1.1, 1.2, 1.4, 1.5, 1.6
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create user_role enum
  pgm.createType('user_role', ['Admin', 'Project_Manager', 'Team_Member']);

  // Create users table
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    password_hash: {
      type: 'varchar(255)',
      notNull: true,
    },
    role: {
      type: 'user_role',
      notNull: true,
      default: 'Team_Member',
    },
    first_name: {
      type: 'varchar(100)',
      notNull: true,
    },
    last_name: {
      type: 'varchar(100)',
      notNull: true,
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

  // Create trigger to auto-update updated_at for users
  pgm.createTrigger('users', 'update_users_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at_column',
    level: 'ROW',
  });

  // Create index on email for fast lookups
  pgm.createIndex('users', 'email', {
    name: 'idx_users_email',
    unique: true,
  });

  // Create index on role for filtering
  pgm.createIndex('users', 'role', {
    name: 'idx_users_role',
  });

  // Create sessions table
  pgm.createTable('sessions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    token: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    expires_at: {
      type: 'timestamp',
      notNull: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    last_accessed_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Create index on token for fast session lookups
  pgm.createIndex('sessions', 'token', {
    name: 'idx_sessions_token',
    unique: true,
  });

  // Create index on user_id for user session queries
  pgm.createIndex('sessions', 'user_id', {
    name: 'idx_sessions_user_id',
  });

  // Create index on expires_at for cleanup queries
  pgm.createIndex('sessions', 'expires_at', {
    name: 'idx_sessions_expires_at',
  });

  // Add comment to tables
  pgm.sql(`
    COMMENT ON TABLE users IS 'User accounts with role-based access control';
    COMMENT ON TABLE sessions IS 'User authentication sessions';
    COMMENT ON TYPE user_role IS 'User roles: Admin, Project_Manager, Team_Member';
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop sessions table first (has foreign key to users)
  pgm.dropTable('sessions', { cascade: true });

  // Drop users table
  pgm.dropTable('users', { cascade: true });

  // Drop user_role enum
  pgm.dropType('user_role');
}
