# Database Migrations Guide

## Overview

The DakiyBuilds platform uses `node-pg-migrate` for managing database schema changes. This guide covers setup, usage, and best practices.

## Setup Complete

The migration system has been configured with:
- Migration tool: `node-pg-migrate`
- Configuration file: `.migrationrc.json`
- Migrations directory: `migrations/`
- Migration scripts in `package.json`
- Helper utilities for common patterns

## Quick Start

### Running Migrations

```bash
# Run all pending migrations
npm run migrate

# Check migration status
npm run migrate:status

# Rollback last migration
npm run migrate:down
```

### Creating New Migrations

```bash
# Create a new migration
npm run migrate:create my-migration-name
```

This creates a timestamped file in `migrations/` directory.

## Configuration

### Environment Variables

Set these in your `.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dakiybuilds
DB_USER=postgres
DB_PASSWORD=your_password

# Optional: Use DATABASE_URL instead
DATABASE_URL=postgresql://user:password@host:port/database

# Auto-run migrations on startup (development only)
AUTO_MIGRATE=false
```

### Migration Configuration

The `.migrationrc.json` file contains:
- Database connection settings
- Migrations directory path
- Migration table name
- TypeScript support

## Migration Structure

Each migration file exports `up` and `down` functions:

```typescript
import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Apply schema changes
  pgm.createTable('users', {
    id: 'id',
    email: { type: 'varchar(255)', notNull: true, unique: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Revert schema changes
  pgm.dropTable('users');
}
```

## Helper Utilities

The `migrations/helpers.ts` file provides reusable functions:

### Add Timestamps

```typescript
import { addTimestamps } from './helpers';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('projects', {
    id: 'id',
    name: { type: 'varchar(255)', notNull: true }
  });
  
  addTimestamps(pgm, 'projects');
}
```

### Create Foreign Keys

```typescript
import { createForeignKey } from './helpers';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('tasks', {
    id: 'id',
    ...createForeignKey('projects', { onDelete: 'CASCADE' })
  });
}
```

### Create Junction Tables

```typescript
import { createJunctionTable } from './helpers';

export async function up(pgm: MigrationBuilder): Promise<void> {
  createJunctionTable(pgm, 'projects', 'users', {
    role: { type: 'varchar(50)', notNull: true }
  });
}
```

## Programmatic Usage

Use the `MigrationRunner` utility in your application:

```typescript
import { migrationRunner } from './utils/migrate';

// Run migrations on startup
await migrationRunner.runOnStartup();

// Or run manually
await migrationRunner.up();

// Check status
const status = await migrationRunner.status();
```

## Best Practices

1. **Test Both Directions**: Always test both `up` and `down` migrations
2. **Keep Migrations Small**: One logical change per migration
3. **Never Modify Committed Migrations**: Create new migrations for changes
4. **Use Transactions**: Migrations run in transactions by default
5. **Add Indexes**: Create indexes for foreign keys and frequently queried columns
6. **Document Complex Logic**: Add comments for non-obvious changes

## Common Patterns

### Creating Tables with Standard Columns

```typescript
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('projects', {
    id: 'id',
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });
  
  // Add trigger for auto-updating updated_at
  pgm.createTrigger('projects', 'update_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at_column',
    level: 'ROW'
  });
}
```

### Creating Enums

```typescript
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType('user_role', ['Admin', 'Project_Manager', 'Team_Member']);
  
  pgm.createTable('users', {
    id: 'id',
    role: { type: 'user_role', notNull: true }
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('users');
  pgm.dropType('user_role');
}
```

### Adding Indexes

```typescript
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createIndex('users', 'email', { unique: true });
  pgm.createIndex('tasks', 'project_id');
  pgm.createIndex('tasks', ['project_id', 'status']);
}
```

## Troubleshooting

### Connection Errors

Ensure PostgreSQL is running and credentials are correct:
```bash
psql -h localhost -U postgres -d dakiybuilds
```

### Migration Table Not Found

Run migrations to create the tracking table:
```bash
npm run migrate
```

### Rollback Multiple Migrations

```bash
npm run migrate:down  # Rollback once
npm run migrate:down  # Rollback again
```

## Next Steps

The migration system is now ready. Upcoming migrations will create:
1. Users and authentication tables (Task 2.2)
2. Projects and team assignments (Task 2.3)
3. Tasks and dependencies (Task 2.4)
4. Documents and versioning (Task 2.5)
5. Forecasts and external data (Task 2.6)
6. Progress tracking (Task 2.7)
