# Task Date-Based Tracking - Design Document

## 1. System Architecture

### 1.1 High-Level Design
The date-based task tracking system will extend the existing task management functionality by adding temporal awareness. The system will automatically calculate task metrics based on calendar dates rather than manual duration inputs.

### 1.2 Component Overview
```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                           │
├─────────────────────────────────────────────────────────────┤
│  TaskForm (Date Pickers) → TaskList (Status Indicators)     │
│  TaskProgressUpdate (Auto/Manual Toggle)                     │
│  Timeline (Date-Based Gantt)                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓ API Calls
┌─────────────────────────────────────────────────────────────┐
│                     Backend Layer                            │
├─────────────────────────────────────────────────────────────┤
│  Task Routes → Task Service (Date Calculations)             │
│  Forecast Service (Date-Based Predictions)                   │
└─────────────────────────────────────────────────────────────┘
                            ↓ Queries
┌─────────────────────────────────────────────────────────────┐
│                     Database Layer                           │
├─────────────────────────────────────────────────────────────┤
│  tasks table: + start_date, end_date, auto_progress_enabled │
└─────────────────────────────────────────────────────────────┘
```

## 2. Data Model

### 2.1 Database Schema Changes

#### Tasks Table Additions
```sql
ALTER TABLE tasks ADD COLUMN start_date DATE;
ALTER TABLE tasks ADD COLUMN end_date DATE;
ALTER TABLE tasks ADD COLUMN auto_progress_enabled BOOLEAN DEFAULT true;

-- Add check constraint
ALTER TABLE tasks ADD CONSTRAINT check_date_order 
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);

-- Add index for date queries
CREATE INDEX idx_tasks_dates ON tasks(start_date, end_date) 
  WHERE start_date IS NOT NULL;
```

### 2.2 Data Migration Strategy
- Existing tasks keep `estimated_duration_days` (backward compatible)
- New tasks use `start_date` and `end_date`
- Migration script to populate dates for existing tasks based on project start date + duration

## 3. API Design

### 3.1 Request/Response Formats

#### Create Task (POST /api/projects/:projectId/tasks)
```typescript
Request Body:
{
  name: string;
  description?: string;
  phase: string;
  startDate: string; // ISO 8601 date
  endDate: string;   // ISO 8601 date
  assignedTo?: string;
  autoProgressEnabled?: boolean; // default: true
}

Response:
{
  success: true;
  data: {
    id: string;
    name: string;
    phase: string;
    start_date: string;
    end_date: string;
    estimated_duration_days: number; // calculated
    progress_percentage: number;     // auto-calculated if enabled
    days_remaining: number;          // calculated
    status: 'not_started' | 'in_progress' | 'overdue' | 'completed';
    auto_progress_enabled: boolean;
    // ... other fields
  }
}
```

### 3.2 Calculated Fields
The backend will compute and return:
- `estimated_duration_days`: `EXTRACT(DAY FROM (end_date - start_date))`
- `days_remaining`: `EXTRACT(DAY FROM (end_date - CURRENT_DATE))`
- `progress_percentage` (if auto-enabled): 
  ```
  IF current_date < start_date THEN 0
  ELSE IF current_date > end_date THEN 100
  ELSE ((current_date - start_date) / (end_date - start_date)) * 100
  ```
- `status`:
  - `not_started`: current_date < start_date
  - `in_progress`: start_date <= current_date <= end_date AND not completed
  - `overdue`: current_date > end_date AND not completed
  - `completed`: is_completed = true

## 4. Business Logic

### 4.1 Progress Calculation Logic
```typescript
function calculateAutoProgress(task: Task): number {
  if (task.is_completed) return 100;
  if (!task.start_date || !task.end_date) return task.progress_percentage;
  
  const now = new Date();
  const start = new Date(task.start_date);
  const end = new Date(task.end_date);
  
  if (now < start) return 0;
  if (now > end) return 100;
  
  const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const elapsedDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  
  return Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
}
```

### 4.2 Status Determination
```typescript
function determineTaskStatus(task: Task): TaskStatus {
  if (task.is_completed) return 'completed';
  
  const now = new Date();
  const start = new Date(task.start_date);
  const end = new Date(task.end_date);
  
  if (now < start) return 'not_started';
  if (now > end) return 'overdue';
  return 'in_progress';
}
```

### 4.3 Days Remaining Calculation
```typescript
function calculateDaysRemaining(task: Task): number {
  if (task.is_completed) return 0;
  if (!task.end_date) return null;
  
  const now = new Date();
  const end = new Date(task.end_date);
  
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays; // Can be negative for overdue tasks
}
```

## 5. User Interface Design

### 5.1 TaskForm Component
```
┌─────────────────────────────────────────────────────────┐
│ Task Details                                             │
├─────────────────────────────────────────────────────────┤
│ Task Name: [________________]                            │
│ Description: [________________]                          │
│ Phase: [________________]                                │
│                                                          │
│ ┌─ Date Range ────────────────────────────────────────┐ │
│ │ Start Date: [📅 MM/DD/YYYY]                         │ │
│ │ End Date:   [📅 MM/DD/YYYY]                         │ │
│ │                                                      │ │
│ │ Duration: 14 days (auto-calculated)                 │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ Assigned To: [Select User ▼]                            │
│                                                          │
│ ┌─ Progress Tracking ──────────────────────────────────┐│
│ │ ☑ Enable automatic progress calculation             ││
│ │   (based on elapsed time)                            ││
│ └──────────────────────────────────────────────────────┘│
│                                                          │
│ [Cancel]                              [Create Task]     │
└─────────────────────────────────────────────────────────┘
```

### 5.2 TaskList Component
```
┌─────────────────────────────────────────────────────────┐
│ Foundation Phase                              ▼ 45%     │
├─────────────────────────────────────────────────────────┤
│ ● Site Preparation                                      │
│   [████████░░░░░░░░░░] 40%                              │
│   📅 Jan 1 - Jan 15  |  ⏱ 3 days remaining             │
│   👤 John Doe        |  🟢 On Track                     │
│                                                          │
│ ● Foundation Pour                                       │
│   [░░░░░░░░░░░░░░░░░░] 0%                               │
│   📅 Jan 16 - Jan 30  |  ⏱ Starts in 5 days            │
│   👤 Unassigned      |  ⚪ Not Started                  │
│                                                          │
│ ● Curing Period                                         │
│   [████████████████████] 100%                           │
│   📅 Dec 1 - Dec 15  |  🔴 Overdue by 2 days           │
│   👤 Jane Smith      |  🔴 Overdue                      │
└─────────────────────────────────────────────────────────┘
```

### 5.3 Status Color Coding
- 🟢 Green (On Track): In progress, progress >= expected progress
- 🟡 Yellow (At Risk): In progress, progress < expected progress
- 🔴 Red (Overdue): Past end date, not completed
- ⚪ Gray (Not Started): Before start date
- 🔵 Blue (Completed): Task completed

## 6. Implementation Phases

### Phase 1: Database & Backend (Week 1)
1. Create migration for new columns
2. Update Task service with date calculations
3. Update Task routes to accept/return date fields
4. Add validation logic
5. Write unit tests

### Phase 2: Frontend Forms (Week 2)
1. Update TaskForm with date pickers
2. Add duration display (read-only)
3. Add auto-progress toggle
4. Update form validation
5. Test form submission

### Phase 3: Frontend Display (Week 3)
1. Update TaskList with status indicators
2. Add days remaining display
3. Implement color coding
4. Update Timeline component
5. Test visual indicators

### Phase 4: Migration & Testing (Week 4)
1. Create data migration script
2. Test backward compatibility
3. Performance testing
4. User acceptance testing
5. Documentation updates

## 7. Error Handling

### 7.1 Validation Errors
- End date before start date → "End date must be after start date"
- Start date in past (optional warning) → "Start date is in the past"
- Date range conflicts with dependencies → "Date range conflicts with dependent tasks"

### 7.2 Edge Cases
- Tasks without dates (legacy) → Fall back to duration-based display
- Timezone handling → Store dates in UTC, display in user timezone
- Leap years → Use proper date arithmetic libraries
- Weekend/holiday handling → Future enhancement

## 8. Performance Considerations

### 8.1 Database Optimization
- Index on (start_date, end_date) for range queries
- Computed columns for frequently accessed calculations
- Caching of calculated fields in Redis (optional)

### 8.2 Frontend Optimization
- Memoize date calculations in React components
- Debounce date picker changes
- Lazy load date picker library

## 9. Security Considerations

- Validate date inputs on backend (prevent SQL injection)
- Sanitize date strings before parsing
- Rate limit date-based queries
- Audit log for date changes

## 10. Testing Strategy

### 10.1 Unit Tests
- Date calculation functions
- Status determination logic
- Progress calculation with various scenarios
- Edge cases (null dates, past dates, future dates)

### 10.2 Integration Tests
- API endpoints with date parameters
- Database constraints
- Migration scripts

### 10.3 E2E Tests
- Create task with dates
- View task list with status indicators
- Update task dates
- Timeline view accuracy

## 11. Rollback Plan

If issues arise:
1. Feature flag to disable date-based tracking
2. Revert to duration-based display
3. Database rollback script available
4. Keep both systems running in parallel initially

## 12. Success Metrics

- 100% of new tasks use date-based tracking
- 0 data loss during migration
- <100ms additional latency for date calculations
- 90%+ user satisfaction with new interface
- Improved timeline accuracy (measured by forecast vs actual)
