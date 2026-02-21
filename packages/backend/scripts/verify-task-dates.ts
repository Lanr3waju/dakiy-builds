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

async function verifyTaskDates() {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        name, 
        start_date, 
        end_date, 
        estimated_duration_days,
        CASE 
          WHEN start_date IS NULL OR end_date IS NULL THEN 'Missing dates'
          ELSE 'Has dates'
        END as status
      FROM tasks
      ORDER BY start_date NULLS LAST
      LIMIT 10;
    `);
    
    console.log('\n=== Task Date Verification ===\n');
    console.log(`Total tasks checked: ${result.rows.length}\n`);
    
    result.rows.forEach(task => {
      console.log(`Task: ${task.name}`);
      console.log(`  Status: ${task.status}`);
      if (task.start_date && task.end_date) {
        console.log(`  Start: ${task.start_date.toISOString().split('T')[0]}`);
        console.log(`  End: ${task.end_date.toISOString().split('T')[0]}`);
        console.log(`  Duration: ${task.estimated_duration_days} days`);
      }
      console.log('');
    });
    
    // Count tasks with and without dates
    const countResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE start_date IS NOT NULL AND end_date IS NOT NULL) as with_dates,
        COUNT(*) FILTER (WHERE start_date IS NULL OR end_date IS NULL) as without_dates,
        COUNT(*) as total
      FROM tasks;
    `);
    
    const counts = countResult.rows[0];
    console.log('=== Summary ===');
    console.log(`Tasks with dates: ${counts.with_dates}`);
    console.log(`Tasks without dates: ${counts.without_dates}`);
    console.log(`Total tasks: ${counts.total}\n`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

verifyTaskDates();
