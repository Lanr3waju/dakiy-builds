import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function checkMigrations() {
  try {
    const result = await pool.query('SELECT id, name, run_on FROM pgmigrations ORDER BY id');
    console.log('\nApplied migrations:');
    result.rows.forEach(row => {
      console.log(`  ${row.id}: ${row.name} (${row.run_on})`);
    });
    console.log('');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkMigrations();
