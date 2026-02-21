import {
  calculateAutoProgress,
  determineTaskStatus,
  calculateDaysRemaining,
  calculateDuration,
  Task,
} from '../src/services/task.service';

console.log('\n=== Testing Date Calculation Functions ===\n');

// Helper to create a test task
function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-task',
    project_id: 'test-project',
    name: 'Test Task',
    description: null,
    phase: 'Test',
    estimated_duration_days: 10,
    actual_duration_days: null,
    progress_percentage: 0,
    is_completed: false,
    completed_at: null,
    assigned_to: null,
    created_by: 'test-user',
    created_at: new Date(),
    updated_at: new Date(),
    start_date: null,
    end_date: null,
    auto_progress_enabled: true,
    ...overrides,
  };
}

// Test calculateAutoProgress
console.log('Test 1: calculateAutoProgress');
console.log('-----------------------------------');

// Test 1a: Task before start date
const futureTask = createTestTask({
  start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
});
const futureProgress = calculateAutoProgress(futureTask);
console.log(`1a. Task before start: ${futureProgress}% (expected: 0%)`);
console.log(futureProgress === 0 ? '✅ PASS' : '❌ FAIL');

// Test 1b: Task in progress (halfway)
const midTask = createTestTask({
  start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
  end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
});
const midProgress = calculateAutoProgress(midTask);
console.log(`1b. Task halfway: ${midProgress}% (expected: ~50%)`);
console.log(midProgress >= 45 && midProgress <= 55 ? '✅ PASS' : '❌ FAIL');

// Test 1c: Task past end date
const pastTask = createTestTask({
  start_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
  end_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
});
const pastProgress = calculateAutoProgress(pastTask);
console.log(`1c. Task past end: ${pastProgress}% (expected: 100%)`);
console.log(pastProgress === 100 ? '✅ PASS' : '❌ FAIL');

// Test 1d: Completed task
const completedTask = createTestTask({
  is_completed: true,
  start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
});
const completedProgress = calculateAutoProgress(completedTask);
console.log(`1d. Completed task: ${completedProgress}% (expected: 100%)`);
console.log(completedProgress === 100 ? '✅ PASS' : '❌ FAIL');

// Test 1e: Task without dates
const noDateTask = createTestTask({
  progress_percentage: 35,
});
const noDateProgress = calculateAutoProgress(noDateTask);
console.log(`1e. Task without dates: ${noDateProgress}% (expected: 35%)`);
console.log(noDateProgress === 35 ? '✅ PASS' : '❌ FAIL');

// Test determineTaskStatus
console.log('\nTest 2: determineTaskStatus');
console.log('-----------------------------------');

// Test 2a: Not started
const notStartedStatus = determineTaskStatus(futureTask);
console.log(`2a. Future task status: ${notStartedStatus} (expected: not_started)`);
console.log(notStartedStatus === 'not_started' ? '✅ PASS' : '❌ FAIL');

// Test 2b: In progress
const inProgressStatus = determineTaskStatus(midTask);
console.log(`2b. Current task status: ${inProgressStatus} (expected: in_progress)`);
console.log(inProgressStatus === 'in_progress' ? '✅ PASS' : '❌ FAIL');

// Test 2c: Overdue
const overdueStatus = determineTaskStatus(pastTask);
console.log(`2c. Past task status: ${overdueStatus} (expected: overdue)`);
console.log(overdueStatus === 'overdue' ? '✅ PASS' : '❌ FAIL');

// Test 2d: Completed
const completedStatus = determineTaskStatus(completedTask);
console.log(`2d. Completed task status: ${completedStatus} (expected: completed)`);
console.log(completedStatus === 'completed' ? '✅ PASS' : '❌ FAIL');

// Test calculateDaysRemaining
console.log('\nTest 3: calculateDaysRemaining');
console.log('-----------------------------------');

// Test 3a: Future task
const futureDays = calculateDaysRemaining(futureTask);
console.log(`3a. Future task days remaining: ${futureDays} (expected: ~14)`);
console.log(futureDays !== null && futureDays >= 13 && futureDays <= 15 ? '✅ PASS' : '❌ FAIL');

// Test 3b: Past task (negative)
const pastDays = calculateDaysRemaining(pastTask);
console.log(`3b. Past task days remaining: ${pastDays} (expected: negative)`);
console.log(pastDays !== null && pastDays < 0 ? '✅ PASS' : '❌ FAIL');

// Test 3c: Completed task
const completedDays = calculateDaysRemaining(completedTask);
console.log(`3c. Completed task days remaining: ${completedDays} (expected: 0)`);
console.log(completedDays === 0 ? '✅ PASS' : '❌ FAIL');

// Test 3d: Task without end date
const noEndDateDays = calculateDaysRemaining(noDateTask);
console.log(`3d. Task without end date: ${noEndDateDays} (expected: null)`);
console.log(noEndDateDays === null ? '✅ PASS' : '❌ FAIL');

// Test calculateDuration
console.log('\nTest 4: calculateDuration');
console.log('-----------------------------------');

// Test 4a: 14 day duration
const duration1 = calculateDuration('2024-01-01', '2024-01-15');
console.log(`4a. Jan 1 to Jan 15: ${duration1} days (expected: 14)`);
console.log(duration1 === 14 ? '✅ PASS' : '❌ FAIL');

// Test 4b: Same day
const duration2 = calculateDuration('2024-01-01', '2024-01-01');
console.log(`4b. Same day: ${duration2} days (expected: 0)`);
console.log(duration2 === 0 ? '✅ PASS' : '❌ FAIL');

// Test 4c: One day
const duration3 = calculateDuration('2024-01-01', '2024-01-02');
console.log(`4c. One day: ${duration3} days (expected: 1)`);
console.log(duration3 === 1 ? '✅ PASS' : '❌ FAIL');

console.log('\n=== All Date Calculation Tests Complete ===\n');
