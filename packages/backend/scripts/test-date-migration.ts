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

async function testMigration() {
  console.log('\n=== Testing Date-Based Tracking Migration ===\n');
  
  try {
    // Test 1: Verify columns exist
    console.log('Test 1: Verifying columns exist...');
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'tasks'
      AND column_name IN ('start_date', 'end_date', 'auto_progress_enabled')
      ORDER BY column_name;
    `);
    
    if (columnsResult.rows.length === 3) {
      console.log('✅ All three columns exist');
      columnsResult.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default || 'none'})`);
      });
    } else {
      console.log('❌ Expected 3 columns, found', columnsResult.rows.length);
      return;
    }

    // Test 2: Verify check constraint exists
    console.log('\nTest 2: Verifying check constraint...');
    const constraintResult = await pool.query(`
      SELECT constraint_name, check_clause
      FROM information_schema.check_constraints
      WHERE constraint_name = 'check_date_order';
    `);
    
    if (constraintResult.rows.length > 0) {
      console.log('✅ Check constraint exists: check_date_order');
    } else {
      console.log('❌ Check constraint not found');
      return;
    }

    // Test 3: Verify index exists
    console.log('\nTest 3: Verifying index...');
    const indexResult = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE indexname = 'idx_tasks_dates';
    `);
    
    if (indexResult.rows.length > 0) {
      console.log('✅ Index exists: idx_tasks_dates');
    } else {
      console.log('❌ Index not found');
      return;
    }

    // Test 4: Test inserting valid data
    console.log('\nTest 4: Testing valid date insertion...');
    const testProjectResult = await pool.query(`
      SELECT id FROM projects LIMIT 1;
    `);
    
    if (testProjectResult.rows.length === 0) {
      console.log('⚠️  No projects found, skipping data insertion tests');
    } else {
      const projectId = testProjectResult.rows[0].id;
      
      // Get a user to use as created_by
      const userResult = await pool.query(`SELECT id FROM users LIMIT 1;`);
      const userId = userResult.rows[0]?.id;
      
      if (!userId) {
        console.log('⚠️  No users found, skipping data insertion tests');
        return;
      }

      // Insert task with valid dates
      const insertResult = await pool.query(`
        INSERT INTO tasks (project_id, name, phase, start_date, end_date, auto_progress_enabled, estimated_duration_days, created_by)
        VALUES ($1, 'Test Task - Valid Dates', 'Test Phase', '2024-01-01', '2024-01-15', true, 14, $2)
        RETURNING id, start_date, end_date, auto_progress_enabled;
      `, [projectId, userId]);
      
      console.log('✅ Successfully inserted task with valid dates');
      console.log(`   Task ID: ${insertResult.rows[0].id}`);
      console.log(`   Start: ${insertResult.rows[0].start_date}, End: ${insertResult.rows[0].end_date}`);
      console.log(`   Auto Progress: ${insertResult.rows[0].auto_progress_enabled}`);
      
      const testTaskId = insertResult.rows[0].id;

      // Test 5: Test check constraint (should fail)
      console.log('\nTest 5: Testing check constraint (end_date < start_date should fail)...');
      try {
        await pool.query(`
          INSERT INTO tasks (project_id, name, phase, start_date, end_date, auto_progress_enabled, estimated_duration_days, created_by)
          VALUES ($1, 'Test Task - Invalid Dates', 'Test Phase', '2024-01-15', '2024-01-01', true, 14, $2);
        `, [projectId, userId]);
        console.log('❌ Check constraint failed - invalid dates were accepted');
      } catch (error: any) {
        if (error.message.includes('check_date_order')) {
          console.log('✅ Check constraint working - invalid dates rejected');
        } else {
          console.log('❌ Unexpected error:', error.message);
        }
      }

      // Test 6: Test nullable dates (backward compatibility)
      console.log('\nTest 6: Testing nullable dates (backward compatibility)...');
      const nullDateResult = await pool.query(`
        INSERT INTO tasks (project_id, name, phase, start_date, end_date, auto_progress_enabled, estimated_duration_days, created_by)
        VALUES ($1, 'Test Task - Null Dates', 'Test Phase', NULL, NULL, true, 10, $2)
        RETURNING id;
      `, [projectId, userId]);
      
      console.log('✅ Successfully inserted task with null dates (backward compatible)');
      console.log(`   Task ID: ${nullDateResult.rows[0].id}`);

      // Test 7: Test auto_progress_enabled default
      console.log('\nTest 7: Testing auto_progress_enabled default value...');
      const defaultResult = await pool.query(`
        INSERT INTO tasks (project_id, name, phase, estimated_duration_days, created_by)
        VALUES ($1, 'Test Task - Default Auto Progress', 'Test Phase', 5, $2)
        RETURNING id, auto_progress_enabled;
      `, [projectId, userId]);
      
      if (defaultResult.rows[0].auto_progress_enabled === true) {
        console.log('✅ auto_progress_enabled defaults to true');
      } else {
        console.log('❌ auto_progress_enabled default is not true');
      }

      // Cleanup test data
      console.log('\nCleaning up test data...');
      await pool.query(`
        DELETE FROM tasks WHERE id IN ($1, $2, $3);
      `, [testTaskId, nullDateResult.rows[0].id, defaultResult.rows[0].id]);
      console.log('✅ Test data cleaned up');
    }

    console.log('\n=== All Migration Tests Passed! ===\n');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  } finally {
    await pool.end();
  }
}

testMigration();
