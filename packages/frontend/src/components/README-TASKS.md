# Task Management Components

This directory contains the task management components for the DakiyBuilds platform.

## Components

### TaskList

Displays tasks grouped by phase with progress bars and dependency information.

**Props:**
- `projectId` (string, required): The project ID to fetch tasks for
- `onEditTask` (function, optional): Callback when edit button is clicked
- `onDeleteTask` (function, optional): Callback when a task is deleted
- `onUpdateProgress` (function, optional): Callback when update progress button is clicked
- `onRefresh` (function, optional): Callback to refresh the task list

**Features:**
- Groups tasks by phase with collapsible sections
- Shows task progress bars
- Displays task dependencies
- Edit and delete actions (role-based)
- Update progress action

**Requirements Validated:** 3.1, 3.4, 3.5

### TaskForm

Form component for creating and editing tasks with dependency management.

**Props:**
- `projectId` (string, required): The project ID for the task
- `taskId` (string, optional): Task ID when editing
- `initialData` (object, optional): Initial form data for editing
- `onSuccess` (function, optional): Callback on successful save
- `onCancel` (function, optional): Callback when form is cancelled

**Features:**
- Create and edit tasks
- Dependency selection interface grouped by phase
- Client-side circular dependency validation
- Duration and phase inputs
- Assigned user selection
- Status management

**Requirements Validated:** 3.1, 3.2, 3.3

### TaskProgressUpdate

Component for updating task progress with history display.

**Props:**
- `taskId` (string, required): The task ID to update
- `currentProgress` (number, required): Current progress percentage (0-100)
- `onSuccess` (function, optional): Callback on successful update

**Features:**
- Progress slider (0-100%)
- Number input for precise values
- Optional notes field
- Progress history display with timestamps
- User attribution for updates

**Requirements Validated:** 10.1, 10.2, 10.3

## Usage Example

```tsx
import TaskList from '../components/TaskList';
import TaskForm from '../components/TaskForm';
import TaskProgressUpdate from '../components/TaskProgressUpdate';

function ProjectDetail() {
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  return (
    <div>
      {/* Task List */}
      <TaskList
        projectId={projectId}
        onEditTask={(task) => {
          setEditingTask(task);
          setShowTaskForm(true);
        }}
        onUpdateProgress={(task) => setSelectedTask(task)}
      />

      {/* Task Form */}
      {showTaskForm && (
        <TaskForm
          projectId={projectId}
          taskId={editingTask?.id}
          initialData={editingTask}
          onSuccess={() => setShowTaskForm(false)}
          onCancel={() => setShowTaskForm(false)}
        />
      )}

      {/* Progress Update */}
      {selectedTask && (
        <TaskProgressUpdate
          taskId={selectedTask.id}
          currentProgress={selectedTask.progress}
          onSuccess={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
```

## API Endpoints Used

### TaskList
- `GET /api/projects/:projectId/tasks` - Fetch all tasks for a project
- `DELETE /api/tasks/:id` - Delete a task

### TaskForm
- `GET /api/projects/:projectId/tasks` - Fetch tasks for dependency selection
- `GET /api/users` - Fetch users for assignment
- `GET /api/tasks/:id` - Fetch existing task data
- `POST /api/projects/:projectId/tasks` - Create new task
- `PUT /api/tasks/:id` - Update existing task
- `POST /api/tasks/:id/dependencies` - Add dependency
- `DELETE /api/tasks/:id/dependencies/:dependencyId` - Remove dependency

### TaskProgressUpdate
- `GET /api/tasks/:id/progress` - Fetch progress history
- `POST /api/tasks/:id/progress` - Update task progress

## Styling

Each component has its own CSS file:
- `TaskList.css` - Styles for task list and phase groups
- `TaskForm.css` - Styles for task form and dependency selection
- `TaskProgressUpdate.css` - Styles for progress slider and history

All components are responsive and work on mobile devices.

## Role-Based Access Control

- **Admin & Project_Manager**: Can create, edit, and delete tasks
- **Team_Member**: Can view tasks and update progress
- All users can view task lists and progress history
