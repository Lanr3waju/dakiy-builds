import 'dotenv/config';
import * as pgMigrate from 'node-pg-migrate';
import { join } from 'path';

async function runMigrations() {
  try {
    console.log('Starting migrations...');
    
    const migrationsDir = join(__dirname, '../migrations');
    
    await pgMigrate.default({
      databaseUrl: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
      dir: migrationsDir,
      direction: 'up',
      migrationsTable: 'pgmigrations',
      count: Infinity,
      verbose: true,
      checkOrder: true,
      ignorePattern: 'helpers\\.ts$',
    });
    
    console.log('\n✓ All migrations completed successfully!');
    
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

runMigrations();
