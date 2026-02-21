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

async function verifyMigration() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'tasks'
      AND column_name IN ('start_date', 'end_date', 'auto_progress_enabled')
      ORDER BY column_name;
    `);

    console.log('\n=== Date-Based Tracking Columns ===');
    if (result.rows.length === 0) {
      console.log('❌ Migration NOT applied - columns do not exist');
    } else {
      console.log('✅ Migration applied successfully!');
      console.log('\nColumns found:');
      result.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default || 'none'})`);
      });
    }

    // Check for constraint
    const constraintResult = await pool.query(`
      SELECT constraint_name, check_clause
      FROM information_schema.check_constraints
      WHERE constraint_name = 'check_date_order';
    `);

    if (constraintResult.rows.length > 0) {
      console.log('\n✅ Check constraint exists: check_date_order');
    }

    // Check for index
    const indexResult = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE indexname = 'idx_tasks_dates';
    `);

    if (indexResult.rows.length > 0) {
      console.log('✅ Index exists: idx_tasks_dates');
    }

    console.log('\n');
  } catch (error) {
    console.error('Error verifying migration:', error);
  } finally {
    await pool.end();
  }
}

verifyMigration();
