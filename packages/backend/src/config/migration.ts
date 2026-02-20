import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Constructs the DATABASE_URL for migrations
 * This is used by node-pg-migrate to connect to the database
 */
export function getDatabaseUrl(): string {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const database = process.env.DB_NAME || 'dakiybuilds';
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || '';

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

// Set DATABASE_URL for node-pg-migrate
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = getDatabaseUrl();
}
