# Task Date Migration Scripts

This directory contains scripts for migrating existing tasks from duration-based tracking to date-based tracking.

## Overview

The date-based tracking feature adds `start_date` and `end_date` fields to tasks, replacing the manual `estimated_duration_days` approach with automatic date calculations.

## Scripts

### 1. migrate-task-dates.ts

**Purpose:** Populate `start_date` and `end_date` for existing tasks that don't have these fields.

**How it works:**
- Fetches all projects and their tasks
- For each project, calculates task dates based on:
  - Project start date
  - Task estimated duration (in working days)
  - Task dependencies (dependent tasks start after their dependencies)
- Uses working days calculation (skips weekends)
- Preserves `estimated_duration_days` for backward compatibility

**Usage:**
```bash
cd packages/backend
npx ts-node scripts/migrate-task-dates.ts
```

**Features:**
- ✅ Handles task dependencies correctly
- ✅ Skips weekends when calculating dates
- ✅ Provides detailed logging of progress
- ✅ Transactional (rolls back on error)
- ✅ Idempotent (can be run multiple times safely)
- ✅ Detects circular dependencies

**Output Example:**
```
=== Task Date Migration Script ===

Step 1: Fetching projects...
✓ Found 2 projects

Processing project: Construction Project A
  Project start date: 2024-01-01
  Found 5 tasks to migrate
  Found 3 dependencies
  ✓ Updated task: Foundation
    Start: 2024-01-01, End: 2024-01-08
  ✓ Updated task: Framing
    Start: 2024-01-09, End: 2024-01-23
  ...

=== Migration Summary ===
Total tasks processed: 10
Tasks updated: 10
Tasks skipped: 0
Errors: 0

✅ Migration completed successfully!
```

### 2. verify-task-dates.ts

**Purpose:** Verify that tasks have been migrated correctly.

**Usage:**
```bash
cd packages/backend
npx ts-node scripts/verify-task-dates.ts
```

**Output:**
- Lists tasks with their dates
- Shows summary of tasks with/without dates
- Useful for checking migration status

### 3. test-migration-with-dependencies.ts

**Purpose:** Test the migration script with sample data including dependencies.

**Usage:**
```bash
cd packages/backend
npx ts-node scripts/test-migration-with-dependencies.ts
```

**What it does:**
- Creates a test project with 4 tasks
- Sets up dependencies between tasks
- Runs the migration
- Verifies that:
  - All tasks get dates
  - Dependencies are respected (dependent tasks start after their dependencies)
  - Working days calculation is correct
- Cleans up test data automatically

## Migration Process

### Before Running Migration

1. **Backup your database:**
   ```bash
   pg_dump -h localhost -U postgres -d dakiybuilds > backup.sql
   ```

2. **Ensure the date tracking migration has been applied:**
   ```bash
   cd packages/backend
   npm run migrate
   ```

3. **Verify database connection:**
   ```bash
   npx ts-node scripts/test-connection.ts
   ```

### Running the Migration

1. **Test on a sample (recommended):**
   ```bash
   npx ts-node scripts/test-migration-with-dependencies.ts
   ```

2. **Run the actual migration:**
   ```bash
   npx ts-node scripts/migrate-task-dates.ts
   ```

3. **Verify results:**
   ```bash
   npx ts-node scripts/verify-task-dates.ts
   ```

### After Migration

1. **Check the logs** for any errors or warnings
2. **Verify a few tasks manually** in the database
3. **Test the application** to ensure date-based features work correctly

## Important Notes

### Working Days Calculation

The migration script uses **working days** (Monday-Friday) when calculating task dates. This means:
- Weekends are automatically skipped
- A 5-day task starting on Friday will end on the following Thursday
- This matches typical construction project scheduling

### Backward Compatibility

- The `estimated_duration_days` field is **preserved** for backward compatibility
- Tasks without dates will continue to work with the old duration-based system
- The migration is **non-destructive** - it only adds dates, doesn't remove data

### Dependencies

The script handles dependencies by:
1. Calculating dates for dependency tasks first
2. Starting dependent tasks the day after their dependencies end
3. Detecting and warning about circular dependencies

### Idempotency

The migration script is **idempotent**:
- It only updates tasks where `start_date IS NULL OR end_date IS NULL`
- Running it multiple times won't duplicate work or cause errors
- Safe to run after adding new tasks

## Troubleshooting

### Issue: "No projects found"
**Solution:** Ensure you have projects in the database. Create at least one project before running migration.

### Issue: "Circular dependency detected"
**Solution:** Review your task dependencies. The script will warn but continue with other tasks.

### Issue: Migration fails mid-way
**Solution:** The script uses transactions and will rollback automatically. Check the error message, fix the issue, and re-run.

### Issue: Dates seem incorrect
**Solution:** 
- Verify the project start date is correct
- Check that task durations are reasonable
- Remember that the script uses working days (excludes weekends)

## Database Schema

The migration populates these fields:

```sql
-- Added by migration 1700000000007_add-task-date-tracking.ts
ALTER TABLE tasks ADD COLUMN start_date DATE;
ALTER TABLE tasks ADD COLUMN end_date DATE;
ALTER TABLE tasks ADD COLUMN auto_progress_enabled BOOLEAN DEFAULT true;

-- Constraint ensures end_date >= start_date
ALTER TABLE tasks ADD CONSTRAINT check_date_order 
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);
```

## Support

If you encounter issues:
1. Check the logs for detailed error messages
2. Verify your database connection and credentials
3. Ensure all migrations have been applied
4. Review the task dependencies for circular references
5. Contact the development team for assistance

## Related Documentation

- [Task Date-Based Tracking Design](../../.kiro/specs/task-date-based-tracking/design.md)
- [Task Date-Based Tracking Requirements](../../.kiro/specs/task-date-based-tracking/requirements.md)
- [Migration Guide](../docs/migrations-guide.md)
