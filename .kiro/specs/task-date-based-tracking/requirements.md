# Task Date-Based Tracking Feature

## Feature Overview
Replace the current duration-based task tracking with date-based tracking that automatically calculates duration, progress, and days remaining based on start and end dates.

## Current State
- Tasks use `estimated_duration_days` field (manual input)
- Progress is manually updated
- No automatic calculation of days remaining
- No date-based progress tracking

## Desired State
- Tasks use `start_date` and `end_date` fields
- Duration is automatically calculated from dates
- Progress is automatically calculated based on:
  - Current date relative to start and end dates
  - Manual progress updates override automatic calculation
- Days remaining calculated from current date to end date
- Visual indicators for:
  - Tasks not yet started
  - Tasks in progress
  - Tasks overdue
  - Tasks completed

## User Stories

### 1. As a project manager, I want to set start and end dates for tasks
**Acceptance Criteria:**
- Task form includes start_date field (date picker)
- Task form includes end_date field (date picker)
- End date must be after start date
- Duration is automatically calculated and displayed (read-only)
- Validation prevents invalid date ranges

### 2. As a project manager, I want to see automatic progress calculation
**Acceptance Criteria:**
- Progress is calculated as: (days elapsed / total days) * 100
- Progress calculation only applies to tasks in progress (current date between start and end)
- Manual progress updates override automatic calculation
- Progress indicator shows both automatic and manual progress

### 3. As a team member, I want to see days remaining for my tasks
**Acceptance Criteria:**
- Task list shows "X days remaining" for active tasks
- Shows "Overdue by X days" for tasks past end date
- Shows "Starts in X days" for future tasks
- Color coding: green (on track), yellow (approaching deadline), red (overdue)

### 4. As a project manager, I want visual indicators for task status
**Acceptance Criteria:**
- Not started: gray indicator
- In progress (on track): green indicator
- In progress (at risk): yellow indicator  
- Overdue: red indicator
- Completed: blue indicator

## Technical Requirements

### Database Changes
1. Add migration to add columns to `tasks` table:
   - `start_date` (DATE, nullable for backward compatibility)
   - `end_date` (DATE, nullable for backward compatibility)
   - `auto_progress_enabled` (BOOLEAN, default true)

2. Keep `estimated_duration_days` for backward compatibility
3. Add computed column or function for `days_remaining`

### Backend Changes
1. Update `task.service.ts`:
   - Add date validation logic
   - Add automatic duration calculation
   - Add automatic progress calculation
   - Add days remaining calculation
   - Update CreateTaskDTO and UpdateTaskDTO interfaces

2. Update `task.routes.ts`:
   - Accept startDate and endDate in API
   - Return calculated fields in responses

3. Update `forecast.service.ts`:
   - Use date-based calculations for forecasting
   - Fall back to duration-based for legacy tasks

### Frontend Changes
1. Update `TaskForm.tsx`:
   - Replace duration input with date pickers
   - Add automatic duration display
   - Add progress calculation mode toggle
   - Update validation logic

2. Update `TaskList.tsx`:
   - Display start and end dates
   - Show days remaining
   - Add status indicators with colors
   - Show progress bar with automatic/manual indicator

3. Update `Timeline.tsx`:
   - Use actual dates instead of calculated dates
   - Improve accuracy of Gantt chart

4. Update `TaskProgressUpdate.tsx`:
   - Add option to use automatic or manual progress
   - Show current automatic progress value
   - Allow override with manual value

## Implementation Notes
- Maintain backward compatibility with existing duration-based tasks
- Provide migration path for existing tasks
- Add feature flag to enable/disable date-based tracking
- Update all relevant documentation

## Success Metrics
- All existing tasks continue to work
- New tasks use date-based tracking by default
- Progress calculations are accurate
- User feedback is positive
- Timeline accuracy improves

## Dependencies
- Database migration must run before backend deployment
- Backend changes must deploy before frontend changes
- Existing tasks should be migrated or support both modes

## Risks
- Data migration complexity
- Backward compatibility issues
- User confusion during transition
- Performance impact of automatic calculations

## Mitigation Strategies
- Thorough testing of migration scripts
- Feature flag for gradual rollout
- User documentation and training
- Performance monitoring and optimization
