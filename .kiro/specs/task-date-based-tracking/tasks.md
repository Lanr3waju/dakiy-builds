# Implementation Plan: Task Date-Based Tracking

## Overview

This implementation converts the duration-based task tracking system to date-based tracking with automatic progress calculation. The plan follows four phases: database migration, backend logic, frontend forms, and frontend display. All changes maintain backward compatibility with existing duration-based tasks.

## Tasks

- [x] 1. Database migration for date-based tracking
  - [x] 1.1 Create and test migration file
    - Create migration file `packages/backend/migrations/[timestamp]_add-task-date-tracking.ts`
    - Add `start_date` (DATE, nullable), `end_date` (DATE, nullable), `auto_progress_enabled` (BOOLEAN, default true) columns to tasks table
    - Add check constraint: `end_date >= start_date` when both are not null
    - Create index: `CREATE INDEX idx_tasks_dates ON tasks(start_date, end_date) WHERE start_date IS NOT NULL`
    - Test migration runs successfully and rollback works
    - _Requirements: 1.1, Technical Requirements - Database Changes_

- [x] 2. Backend date calculation functions
  - [x] 2.1 Implement core date calculation logic in task.service.ts
    - Add `calculateAutoProgress(task)` function (returns 0-100 based on elapsed time)
    - Add `determineTaskStatus(task)` function (returns 'not_started' | 'in_progress' | 'overdue' | 'completed')
    - Add `calculateDaysRemaining(task)` function (returns number, negative for overdue)
    - Add `calculateDuration(startDate, endDate)` function (returns days between dates)
    - _Requirements: 2.2, 3.1, Technical Requirements - Backend Changes_
  
  - [ ]* 2.2 Write unit tests for date calculations
    - Test `calculateAutoProgress` for tasks before start, in progress, and past end date
    - Test `determineTaskStatus` for all status states
    - Test `calculateDaysRemaining` with positive and negative values
    - Test edge cases: null dates, same start/end date, leap years
    - _Requirements: 2.2, 3.1_

- [x] 3. Backend API updates for date fields
  - [x] 3.1 Update DTOs and interfaces in task.service.ts
    - Add `startDate?: string`, `endDate?: string`, `autoProgressEnabled?: boolean` to CreateTaskDTO
    - Add same fields to UpdateTaskDTO
    - Add validation: endDate must be >= startDate when both provided
    - Update task response interface to include calculated fields: `days_remaining`, `status`
    - _Requirements: 1.1, Technical Requirements - Backend Changes_
  
  - [x] 3.2 Update task.routes.ts to handle date fields
    - Modify POST `/api/projects/:projectId/tasks` to accept startDate, endDate, autoProgressEnabled
    - Modify PUT `/api/projects/:projectId/tasks/:taskId` to accept date updates
    - Add validation middleware to check date range validity
    - Ensure responses include calculated fields (duration, days_remaining, status, progress_percentage)
    - _Requirements: 1.1, Technical Requirements - Backend Changes_
  
  - [ ]* 3.3 Write integration tests for task API
    - Test creating task with valid date range returns calculated fields
    - Test creating task with invalid date range (end before start) returns error
    - Test updating task dates recalculates fields
    - Test backward compatibility: tasks without dates still work
    - _Requirements: 1.1, 2.2, 3.1_

- [x] 4. Checkpoint - Backend validation
  - Run all backend tests (unit + integration)
  - Verify migration applies and rolls back cleanly
  - Ensure all tests pass, ask the user if questions arise

- [x] 5. Frontend task form with date pickers
  - [x] 5.1 Update TaskForm.tsx for date input
    - Replace `estimated_duration_days` input with date pickers for `startDate` and `endDate`
    - Add read-only duration display that auto-calculates from selected dates
    - Add checkbox/toggle for "Enable automatic progress calculation" (autoProgressEnabled)
    - Update form state to manage startDate, endDate, autoProgressEnabled fields
    - Update form submission to send date fields to API
    - _Requirements: 1.1, Technical Requirements - Frontend Changes_
  
  - [x] 5.2 Add date validation to TaskForm
    - Validate endDate is after startDate before submission
    - Display error message: "End date must be after start date"
    - Optionally warn if startDate is in the past
    - Prevent form submission when validation fails
    - _Requirements: 1.1_
  
  - [x] 5.3 Style date pickers in TaskForm.css
    - Style date picker inputs to match existing form design
    - Style read-only duration display field
    - Style auto-progress toggle/checkbox
    - Ensure responsive layout for date fields
    - _Requirements: 1.1_

- [x] 6. Frontend task list with status indicators
  - [x] 6.1 Update TaskList.tsx for date-based display
    - Display start_date and end_date for each task (format: "Jan 1 - Jan 15")
    - Show days remaining text: "X days remaining" (positive), "Overdue by X days" (negative), "Starts in X days" (future)
    - Add status indicator badges with icons: ⚪ Not Started, 🟢 On Track, 🟡 At Risk, 🔴 Overdue, 🔵 Completed
    - Implement color coding based on task status
    - Show progress bar with indicator for auto vs manual progress
    - _Requirements: 3.1, 4.1, Technical Requirements - Frontend Changes_
  
  - [x] 6.2 Style status indicators in TaskList.css
    - Add CSS classes for status colors: `.status-not-started` (gray), `.status-on-track` (green), `.status-at-risk` (yellow), `.status-overdue` (red), `.status-completed` (blue)
    - Style days remaining text with appropriate colors
    - Style status badges/icons for visual clarity
    - Ensure accessibility (sufficient contrast, not relying only on color)
    - _Requirements: 4.1_

- [x] 7. Frontend timeline component updates
  - [x] 7.1 Update Timeline.tsx to use actual dates
    - Replace calculated dates with task.start_date and task.end_date
    - Update Gantt chart rendering to use actual date ranges
    - Handle tasks without dates (legacy): fall back to calculated dates from duration
    - Improve timeline accuracy with real dates
    - _Requirements: Technical Requirements - Frontend Changes_
  
  - [x] 7.2 Style timeline for date-based display
    - Update Timeline.css to show date labels clearly
    - Add visual distinction for overdue tasks (red bars)
    - Apply status colors to timeline bars
    - _Requirements: 4.1_

- [x] 8. Frontend progress update component
  - [x] 8.1 Update TaskProgressUpdate.tsx for auto/manual modes
    - Add toggle to switch between automatic and manual progress tracking
    - Display current automatic progress value (read-only) when auto mode enabled
    - Allow manual progress input when auto mode disabled
    - Show indicator badge: "Auto" or "Manual" progress mode
    - Update API calls to include autoProgressEnabled flag when updating progress
    - _Requirements: 2.2, Technical Requirements - Frontend Changes_
  
  - [x] 8.2 Style progress mode controls in TaskProgressUpdate.css
    - Style auto/manual toggle switch
    - Style automatic progress display (read-only)
    - Style progress mode indicator badge
    - _Requirements: 2.2_

- [x] 9. Checkpoint - Frontend validation
  - Run all frontend tests
  - Manually test all UI components render correctly
  - Test form validation and submission flows
  - Ensure all tests pass, ask the user if questions arise

- [x] 10. Update forecast service for date-based calculations
  - [x] 10.1 Modify forecast.service.ts to use dates
    - Update forecast algorithms to use start_date and end_date for calculations
    - Fall back to estimated_duration_days for legacy tasks without dates
    - Improve forecast accuracy using actual date data
    - _Requirements: Technical Requirements - Backend Changes_

- [x] 11. Data migration and backward compatibility
  - [x] 11.1 Create data migration script
    - Create script `packages/backend/scripts/migrate-task-dates.ts`
    - Populate start_date and end_date for existing tasks based on project start date + estimated_duration_days
    - Preserve estimated_duration_days for backward compatibility
    - Add logging for migration progress and errors
    - Test script on sample data before production use
    - _Requirements: Technical Requirements - Database Changes, Implementation Notes_
  
  - [x] 11.2 Ensure backward compatibility in all components
    - Update task.service.ts to handle tasks with only estimated_duration_days (no dates)
    - Update TaskList.tsx to display duration-based tasks appropriately
    - Update Timeline.tsx to calculate dates from duration for legacy tasks
    - Ensure API responses work for both date-based and duration-based tasks
    - _Requirements: Implementation Notes_

- [x] 12. End-to-end integration testing
  - [x] 12.1 Test complete user flows
    - Test: Create new task with dates through UI, verify it appears in task list with correct status
    - Test: Update task dates, verify recalculation of duration and days remaining
    - Test: View timeline, verify date ranges display accurately
    - Test: Toggle auto/manual progress mode, verify progress updates correctly
    - Test: Create task with invalid date range, verify validation error appears
    - Test: View legacy tasks (duration-based), verify they display correctly
    - _Requirements: All user stories 1.1, 2.1, 3.1, 4.1_

- [x] 13. Final checkpoint and deployment readiness
  - Run full test suite (backend + frontend)
  - Verify all features work end-to-end
  - Test backward compatibility with existing tasks
  - Verify migration script is ready for production
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Database migration must run before backend deployment
- Backend changes must deploy before frontend changes
- Use date-fns or similar library for date arithmetic to handle edge cases
- Store dates in UTC in database, display in user timezone in frontend
- All date calculations should handle null dates gracefully for backward compatibility
- Consider adding feature flag for gradual rollout if needed

