import { exec } from 'child_process';
import { promisify } from 'util';
import logger from './logger';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Migration utility for running database migrations programmatically
 */
export class MigrationRunner {
  constructor() {
    // Migration path is configured in package.json
  }

  /**
   * Run all pending migrations
   */
  async up(): Promise<void> {
    try {
      logger.info('Running database migrations...');
      const { stdout, stderr } = await execAsync('npm run migrate', {
        cwd: path.join(__dirname, '../..'),
      });
      
      if (stdout) logger.info(stdout);
      if (stderr) logger.warn(stderr);
      
      logger.info('Database migrations completed successfully');
    } catch (error) {
      logger.error('Failed to run database migrations', { error });
      throw error;
    }
  }

  /**
   * Rollback the last migration
   */
  async down(): Promise<void> {
    try {
      logger.info('Rolling back last migration...');
      const { stdout, stderr } = await execAsync('npm run migrate:down', {
        cwd: path.join(__dirname, '../..'),
      });
      
      if (stdout) logger.info(stdout);
      if (stderr) logger.warn(stderr);
      
      logger.info('Migration rollback completed successfully');
    } catch (error) {
      logger.error('Failed to rollback migration', { error });
      throw error;
    }
  }

  /**
   * Check migration status
   */
  async status(): Promise<string> {
    try {
      const { stdout } = await execAsync('npm run migrate:status', {
        cwd: path.join(__dirname, '../..'),
      });
      return stdout;
    } catch (error) {
      logger.error('Failed to check migration status', { error });
      throw error;
    }
  }

  /**
   * Run migrations on application startup if AUTO_MIGRATE is enabled
   */
  async runOnStartup(): Promise<void> {
    const autoMigrate = process.env.AUTO_MIGRATE === 'true';
    
    if (autoMigrate) {
      logger.info('AUTO_MIGRATE enabled, running migrations on startup');
      await this.up();
    } else {
      logger.info('AUTO_MIGRATE disabled, skipping automatic migrations');
      logger.info('Run "npm run migrate" manually to apply pending migrations');
    }
  }
}

// Export singleton instance
export const migrationRunner = new MigrationRunner();
