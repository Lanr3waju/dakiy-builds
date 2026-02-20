import 'dotenv/config';
import { Pool } from 'pg';

console.log('Environment variables:');
console.log('DB_HOST:', process.env.DB_HOST || 'localhost');
console.log('DB_PORT:', process.env.DB_PORT || '5432');
console.log('DB_NAME:', process.env.DB_NAME || 'dakiybuilds');
console.log('DB_USER:', process.env.DB_USER || 'postgres');
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'not set');
console.log('');

async function testConnection() {
  // First, try connecting to postgres database (which always exists)
  console.log('Test 1: Connecting to "postgres" database...');
  const postgresPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    const client = await postgresPool.connect();
    console.log('✓ Connected to postgres database');
    
    // List all databases
    const { rows } = await client.query(
      "SELECT datname FROM pg_database WHERE datistemplate = false"
    );
    console.log('\nDatabases found:');
    rows.forEach(row => console.log('  -', row.datname));
    
    client.release();
    await postgresPool.end();
  } catch (error: any) {
    console.error('✗ Failed to connect to postgres database:', error.message);
    process.exit(1);
  }

  // Now try connecting to dakiybuilds
  console.log('\nTest 2: Connecting to "dakiybuilds" database...');
  const dakiyPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'dakiybuilds',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    const client = await dakiyPool.connect();
    console.log('✓ Connected to dakiybuilds database');
    
    const { rows } = await client.query('SELECT current_database(), version()');
    console.log('Database:', rows[0].current_database);
    console.log('Version:', rows[0].version.split('\n')[0]);
    
    client.release();
    await dakiyPool.end();
    
    console.log('\n✓ All tests passed!');
  } catch (error: any) {
    console.error('✗ Failed to connect to dakiybuilds database:', error.message);
    console.error('\nThis means the database truly does not exist in the PostgreSQL instance');
    console.error('that your application is connecting to.');
    process.exit(1);
  }
}

testConnection();
