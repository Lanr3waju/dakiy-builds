import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

/**
 * Data Migration Script: Populate start_date and end_date for existing tasks
 * 
 * This script migrates existing tasks from duration-based tracking to date-based tracking.
 * It calculates start and end dates based on:
 * - Project start date
 * - Task estimated_duration_days
 * - Task dependencies (dependent tasks start after their dependencies)
 * 
 * The script preserves estimated_duration_days for backward compatibility.
 */

interface Task {
  id: string;
  project_id: string;
  name: string;
  phase: string;
  estimated_duration_days: number;
  start_date: Date | null;
  end_date: Date | null;
}

interface Project {
  id: string;
  name: string;
  start_date: Date;
}

interface TaskDependency {
  task_id: string;
  depends_on_task_id: string;
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'dakiybuilds',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

/**
 * Add working days to a date (skips weekends)
 * @param date - Starting date
 * @param days - Number of working days to add
 * @returns New date after adding working days
 */
function addWorkingDays(date: Date, days: number): Date {
  const result = new Date(date);
  let addedDays = 0;
  
  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      addedDays++;
    }
  }
  
  return result;
}

/**
 * Calculate start and end dates for tasks considering dependencies
 * @param tasks - Array of tasks to process
 * @param dependencies - Array of task dependencies
 * @param projectStartDate - Project start date
 * @returns Map of task IDs to calculated dates
 */
function calculateTaskDates(
  tasks: Task[],
  dependencies: TaskDependency[],
  projectStartDate: Date
): Map<string, { startDate: Date; endDate: Date }> {
  const taskDates = new Map<string, { startDate: Date; endDate: Date }>();
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const dependencyMap = new Map<string, string[]>();
  
  // Build dependency map (task_id -> [depends_on_task_ids])
  dependencies.forEach(dep => {
    if (!dependencyMap.has(dep.task_id)) {
      dependencyMap.set(dep.task_id, []);
    }
    dependencyMap.get(dep.task_id)!.push(dep.depends_on_task_id);
  });
  
  /**
   * Recursively calculate dates for a task and its dependencies
   */
  function calculateForTask(taskId: string, visited = new Set<string>()): void {
    // Prevent circular dependencies
    if (visited.has(taskId)) {
      console.warn(`⚠️  Circular dependency detected for task ${taskId}`);
      return;
    }
    
    // Already calculated
    if (taskDates.has(taskId)) {
      return;
    }
    
    visited.add(taskId);
    const task = taskMap.get(taskId);
    
    if (!task) {
      return;
    }
    
    // Calculate dependencies first
    const deps = dependencyMap.get(taskId) || [];
    deps.forEach(depId => calculateForTask(depId, new Set(visited)));
    
    // Find the latest end date among dependencies
    let startDate = new Date(projectStartDate);
    
    deps.forEach(depId => {
      const depDates = taskDates.get(depId);
      if (depDates && depDates.endDate > startDate) {
        // Start the day after the dependency ends
        startDate = new Date(depDates.endDate);
        startDate.setDate(startDate.getDate() + 1);
      }
    });
    
    // Calculate end date based on duration
    const endDate = addWorkingDays(startDate, task.estimated_duration_days);
    
    taskDates.set(taskId, { startDate, endDate });
  }
  
  // Calculate dates for all tasks
  tasks.forEach(task => calculateForTask(task.id));
  
  return taskDates;
}

/**
 * Main migration function
 */
async function migrateTaskDates() {
  console.log('\n=== Task Date Migration Script ===\n');
  console.log('This script will populate start_date and end_date for existing tasks');
  console.log('based on project start dates and task durations.\n');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Step 1: Get all projects
    console.log('Step 1: Fetching projects...');
    const projectsResult = await client.query<Project>(`
      SELECT id, name, start_date
      FROM projects
      ORDER BY start_date;
    `);
    
    console.log(`✓ Found ${projectsResult.rows.length} projects\n`);
    
    if (projectsResult.rows.length === 0) {
      console.log('No projects found. Migration complete.');
      await client.query('COMMIT');
      return;
    }
    
    let totalTasksProcessed = 0;
    let totalTasksUpdated = 0;
    let totalTasksSkipped = 0;
    let totalErrors = 0;
    
    // Step 2: Process each project
    for (const project of projectsResult.rows) {
      console.log(`\nProcessing project: ${project.name} (${project.id})`);
      console.log(`  Project start date: ${project.start_date.toISOString().split('T')[0]}`);
      
      // Get tasks without dates for this project
      const tasksResult = await client.query<Task>(`
        SELECT id, project_id, name, phase, estimated_duration_days, start_date, end_date
        FROM tasks
        WHERE project_id = $1
        AND (start_date IS NULL OR end_date IS NULL)
        ORDER BY phase, name;
      `, [project.id]);
      
      if (tasksResult.rows.length === 0) {
        console.log(`  ✓ No tasks need migration for this project`);
        continue;
      }
      
      console.log(`  Found ${tasksResult.rows.length} tasks to migrate`);
      
      // Get dependencies for this project's tasks
      const taskIds = tasksResult.rows.map(t => t.id);
      const depsResult = await client.query<TaskDependency>(`
        SELECT task_id, depends_on_task_id
        FROM task_dependencies
        WHERE task_id = ANY($1::uuid[]);
      `, [taskIds]);
      
      console.log(`  Found ${depsResult.rows.length} dependencies`);
      
      // Calculate dates for all tasks
      const taskDates = calculateTaskDates(
        tasksResult.rows,
        depsResult.rows,
        project.start_date
      );
      
      // Update tasks with calculated dates
      for (const task of tasksResult.rows) {
        totalTasksProcessed++;
        
        const dates = taskDates.get(task.id);
        
        if (!dates) {
          console.log(`  ⚠️  Could not calculate dates for task: ${task.name}`);
          totalErrors++;
          continue;
        }
        
        try {
          await client.query(`
            UPDATE tasks
            SET start_date = $1, end_date = $2
            WHERE id = $3;
          `, [dates.startDate, dates.endDate, task.id]);
          
          totalTasksUpdated++;
          
          console.log(`  ✓ Updated task: ${task.name}`);
          console.log(`    Start: ${dates.startDate.toISOString().split('T')[0]}, End: ${dates.endDate.toISOString().split('T')[0]}`);
        } catch (error: any) {
          console.error(`  ❌ Error updating task ${task.name}:`, error.message);
          totalErrors++;
        }
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Summary
    console.log('\n=== Migration Summary ===');
    console.log(`Total tasks processed: ${totalTasksProcessed}`);
    console.log(`Tasks updated: ${totalTasksUpdated}`);
    console.log(`Tasks skipped: ${totalTasksSkipped}`);
    console.log(`Errors: ${totalErrors}`);
    
    if (totalErrors === 0) {
      console.log('\n✅ Migration completed successfully!\n');
    } else {
      console.log('\n⚠️  Migration completed with errors. Please review the log above.\n');
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
if (require.main === module) {
  migrateTaskDates()
    .then(() => {
      console.log('Migration script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { migrateTaskDates };
