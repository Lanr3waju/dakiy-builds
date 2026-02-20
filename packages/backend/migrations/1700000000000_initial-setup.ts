import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands: any = undefined;

/**
 * Initial database setup migration
 * 
 * This migration creates the initial database structure comment
 * and prepares the database for subsequent migrations.
 * 
 * The actual table creation will be done in subsequent migrations:
 * - Users and authentication tables
 * - Projects and team assignments
 * - Tasks and dependencies
 * - Documents and versioning
 * - Forecasts and external data
 * - Progress tracking
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Add a comment to the database to mark initial setup
  pgm.sql(`
    COMMENT ON DATABASE ${process.env.DB_NAME || 'dakiybuilds'} IS 
    'DakiyBuilds - AI-Powered Construction Project Management Platform';
  `);

  // Create a custom function for updating timestamps
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  // Log successful initialization
  pgm.sql(`
    DO $$
    BEGIN
      RAISE NOTICE 'Database initialized successfully';
    END $$;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop the timestamp update function
  pgm.sql(`
    DROP FUNCTION IF EXISTS update_updated_at_column();
  `);

  // Note: We don't remove the database comment on rollback
  // as it's harmless and informational
}
