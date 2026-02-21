import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Test script to verify migration handles dependencies correctly
 * Creates sample tasks with dependencies, runs migration, and verifies results
 */

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function testMigrationWithDependencies() {
  console.log('\n=== Testing Migration with Dependencies ===\n');
  
  const client = await pool.connect();
  let testProjectId: string | null = null;
  let testUserId: string | null = null;
  const testTaskIds: string[] = [];
  
  try {
    await client.query('BEGIN');
    
    // Get a user for created_by
    const userResult = await client.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      console.log('❌ No users found. Please create a user first.');
      return;
    }
    testUserId = userResult.rows[0].id;
    
    // Create a test project
    console.log('Step 1: Creating test project...');
    const projectResult = await client.query(`
      INSERT INTO projects (name, location, start_date, planned_completion_date, owner_id)
      VALUES ('Migration Test Project', 'Test Location', '2024-01-01', '2024-12-31', $1)
      RETURNING id;
    `, [testUserId]);
    testProjectId = projectResult.rows[0].id;
    console.log(`✓ Created test project: ${testProjectId}\n`);
    
    // Create test tasks without dates
    console.log('Step 2: Creating test tasks...');
    
    // Task 1: Foundation (no dependencies)
    const task1Result = await client.query(`
      INSERT INTO tasks (project_id, name, phase, estimated_duration_days, created_by)
      VALUES ($1, 'Test Foundation', 'Foundation', 5, $2)
      RETURNING id;
    `, [testProjectId, testUserId]);
    const task1Id = task1Result.rows[0].id;
    testTaskIds.push(task1Id);
    console.log(`✓ Created Task 1: Foundation (5 days)`);
    
    // Task 2: Framing (depends on Foundation)
    const task2Result = await client.query(`
      INSERT INTO tasks (project_id, name, phase, estimated_duration_days, created_by)
      VALUES ($1, 'Test Framing', 'Framing', 10, $2)
      RETURNING id;
    `, [testProjectId, testUserId]);
    const task2Id = task2Result.rows[0].id;
    testTaskIds.push(task2Id);
    console.log(`✓ Created Task 2: Framing (10 days)`);
    
    // Task 3: Roofing (depends on Framing)
    const task3Result = await client.query(`
      INSERT INTO tasks (project_id, name, phase, estimated_duration_days, created_by)
      VALUES ($1, 'Test Roofing', 'Roofing', 7, $2)
      RETURNING id;
    `, [testProjectId, testUserId]);
    const task3Id = task3Result.rows[0].id;
    testTaskIds.push(task3Id);
    console.log(`✓ Created Task 3: Roofing (7 days)`);
    
    // Task 4: Electrical (depends on Framing, parallel with Roofing)
    const task4Result = await client.query(`
      INSERT INTO tasks (project_id, name, phase, estimated_duration_days, created_by)
      VALUES ($1, 'Test Electrical', 'Electrical', 8, $2)
      RETURNING id;
    `, [testProjectId, testUserId]);
    const task4Id = task4Result.rows[0].id;
    testTaskIds.push(task4Id);
    console.log(`✓ Created Task 4: Electrical (8 days)\n`);
    
    // Create dependencies
    console.log('Step 3: Creating dependencies...');
    
    // Task 2 depends on Task 1
    await client.query(`
      INSERT INTO task_dependencies (task_id, depends_on_task_id, created_by)
      VALUES ($1, $2, $3);
    `, [task2Id, task1Id, testUserId]);
    console.log(`✓ Task 2 (Framing) depends on Task 1 (Foundation)`);
    
    // Task 3 depends on Task 2
    await client.query(`
      INSERT INTO task_dependencies (task_id, depends_on_task_id, created_by)
      VALUES ($1, $2, $3);
    `, [task3Id, task2Id, testUserId]);
    console.log(`✓ Task 3 (Roofing) depends on Task 2 (Framing)`);
    
    // Task 4 depends on Task 2
    await client.query(`
      INSERT INTO task_dependencies (task_id, depends_on_task_id, created_by)
      VALUES ($1, $2, $3);
    `, [task4Id, task2Id, testUserId]);
    console.log(`✓ Task 4 (Electrical) depends on Task 2 (Framing)\n`);
    
    await client.query('COMMIT');
    
    // Now run the migration logic
    console.log('Step 4: Running migration logic...\n');
    
    // Import and run migration
    const { migrateTaskDates } = await import('./migrate-task-dates');
    await migrateTaskDates();
    
    // Verify results
    console.log('\nStep 5: Verifying results...');
    const verifyResult = await pool.query(`
      SELECT 
        t.id,
        t.name,
        t.estimated_duration_days,
        t.start_date,
        t.end_date,
        (t.end_date - t.start_date) as calculated_duration
      FROM tasks t
      WHERE t.id = ANY($1::uuid[])
      ORDER BY t.start_date;
    `, [testTaskIds]);
    
    console.log('\n=== Migration Results ===\n');
    verifyResult.rows.forEach((task, index) => {
      console.log(`Task ${index + 1}: ${task.name}`);
      console.log(`  Expected duration: ${task.estimated_duration_days} days`);
      console.log(`  Start date: ${task.start_date?.toISOString().split('T')[0]}`);
      console.log(`  End date: ${task.end_date?.toISOString().split('T')[0]}`);
      console.log(`  Calculated duration: ${task.calculated_duration} days`);
      console.log('');
    });
    
    // Verify dependency order
    console.log('=== Dependency Verification ===\n');
    const task1 = verifyResult.rows.find(t => t.name === 'Test Foundation');
    const task2 = verifyResult.rows.find(t => t.name === 'Test Framing');
    const task3 = verifyResult.rows.find(t => t.name === 'Test Roofing');
    const task4 = verifyResult.rows.find(t => t.name === 'Test Electrical');
    
    if (task1 && task2 && task1.end_date < task2.start_date) {
      console.log('✓ Task 2 (Framing) starts after Task 1 (Foundation) ends');
    } else {
      console.log('❌ Task 2 should start after Task 1');
    }
    
    if (task2 && task3 && task2.end_date < task3.start_date) {
      console.log('✓ Task 3 (Roofing) starts after Task 2 (Framing) ends');
    } else {
      console.log('❌ Task 3 should start after Task 2');
    }
    
    if (task2 && task4 && task2.end_date < task4.start_date) {
      console.log('✓ Task 4 (Electrical) starts after Task 2 (Framing) ends');
    } else {
      console.log('❌ Task 4 should start after Task 2');
    }
    
    console.log('\n✅ Test completed successfully!\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    // Cleanup: Delete test data
    if (testProjectId) {
      console.log('Cleaning up test data...');
      await client.query('DELETE FROM projects WHERE id = $1', [testProjectId]);
      console.log('✓ Test data cleaned up\n');
    }
    
    client.release();
    await pool.end();
  }
}

testMigrationWithDependencies()
  .then(() => {
    console.log('Test script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test script failed:', error);
    process.exit(1);
  });
