# Database Migrations

This directory contains database migration files for the DakiyBuilds platform.

## Migration Tool

We use [node-pg-migrate](https://github.com/salsita/node-pg-migrate) for managing database schema changes.

## Configuration

Migration configuration is stored in `.migrationrc.json` at the backend root.

## Available Commands

- `npm run migrate` - Run all pending migrations (up)
- `npm run migrate:down` - Rollback the last migration
- `npm run migrate:create <name>` - Create a new migration file
- `npm run migrate:status` - Check migration status

## Creating a New Migration

```bash
npm run migrate:create my-migration-name
```

This will create a new timestamped migration file in the `migrations/` directory.

## Migration File Structure

Each migration file exports two functions:
- `up`: Applies the migration (schema changes)
- `down`: Reverts the migration (rollback)

Example:
```typescript
import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Apply changes
  pgm.createTable('users', {
    id: 'id',
    email: { type: 'varchar(255)', notNull: true, unique: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Revert changes
  pgm.dropTable('users');
}
```

## Best Practices

1. **Always test migrations**: Test both `up` and `down` migrations before committing
2. **Keep migrations small**: Each migration should focus on a single logical change
3. **Never modify existing migrations**: Once a migration is committed and run in production, create a new migration for changes
4. **Use transactions**: Migrations run in transactions by default, ensuring atomicity
5. **Document complex changes**: Add comments for non-obvious schema changes

## Migration Naming Convention

Migrations are automatically prefixed with a timestamp. Use descriptive names:
- `create-users-table`
- `add-role-to-users`
- `create-projects-table`
- `add-indexes-to-tasks`

## Environment Variables

Migrations use the following environment variables (from `.env`):
- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name (default: dakiybuilds)
- `DB_USER` - Database user (default: postgres)
- `DB_PASSWORD` - Database password

Alternatively, you can set `DATABASE_URL` directly:
```
DATABASE_URL=postgresql://user:password@host:port/database
```

## Troubleshooting

### Migration fails with connection error
- Check that PostgreSQL is running
- Verify environment variables in `.env`
- Ensure database exists: `createdb dakiybuilds`

### Migration table not found
- Run `npm run migrate` to create the migrations table automatically

### Need to rollback multiple migrations
```bash
npm run migrate:down  # Rollback once
npm run migrate:down  # Rollback again
# Or specify count: node-pg-migrate down 3
```
