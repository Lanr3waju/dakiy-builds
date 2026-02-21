import { Pool } from 'pg';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function checkColumnsExist(): Promise<boolean> {
  const result = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'tasks'
    AND column_name IN ('start_date', 'end_date', 'auto_progress_enabled')
  `);
  return result.rows.length === 3;
}

async function testRollback() {
  console.log('\n=== Testing Migration Rollback ===\n');
  
  try {
    // Step 1: Verify migration is currently applied
    console.log('Step 1: Verifying migration is applied...');
    const beforeRollback = await checkColumnsExist();
    if (!beforeRollback) {
      console.log('❌ Migration not applied - cannot test rollback');
      return;
    }
    console.log('✅ Migration is applied');

    // Step 2: Rollback the migration
    console.log('\nStep 2: Rolling back migration...');
    try {
      execSync('npm run migrate:down', { 
        cwd: process.cwd(),
        stdio: 'inherit'
      });
      console.log('✅ Rollback command executed');
    } catch (error) {
      console.log('❌ Rollback command failed');
      throw error;
    }

    // Step 3: Verify columns are removed
    console.log('\nStep 3: Verifying columns are removed...');
    const afterRollback = await checkColumnsExist();
    if (afterRollback) {
      console.log('❌ Rollback failed - columns still exist');
      return;
    }
    console.log('✅ Columns successfully removed');

    // Step 4: Re-apply the migration
    console.log('\nStep 4: Re-applying migration...');
    try {
      execSync('npm run migrate', { 
        cwd: process.cwd(),
        stdio: 'inherit'
      });
      console.log('✅ Migration re-applied');
    } catch (error) {
      console.log('❌ Migration re-apply failed');
      throw error;
    }

    // Step 5: Verify columns are back
    console.log('\nStep 5: Verifying columns are restored...');
    const afterReapply = await checkColumnsExist();
    if (!afterReapply) {
      console.log('❌ Re-apply failed - columns not restored');
      return;
    }
    console.log('✅ Columns successfully restored');

    console.log('\n=== Rollback Test Passed! ===\n');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  } finally {
    await pool.end();
  }
}

testRollback();
