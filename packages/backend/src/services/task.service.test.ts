import { pool } from '../config/database';
import {
  createTask,
  updateTask,
  deleteTask,
  getTask,
  listTasksByProject,
  addDependency,
  removeDependency,
  getTaskDependencyTree,
  updateProgress,
  getProgressHistory,
  CreateTaskDTO,
  UpdateTaskDTO,
} from './task.service';
import { ValidationError, NotFoundError } from '../utils/errors';

// Mock the pool
jest.mock('../config/database', () => ({
  pool: {
    connect: jest.fn(),
    query: jest.fn(),
  },
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Task Service', () => {
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  describe('createTask', () => {
    const projectId = 'project-123';
    const userId = 'user-123';
    const taskData: CreateTaskDTO = {
      name: 'Foundation Work',
      description: 'Pour concrete foundation',
      phase: 'Foundation',
      estimated_duration_days: 10,
      assigned_to: 'user-456',
    };

    it('should create a task with valid data', async () => {
      const mockTask = {
        id: 'task-123',
        project_id: projectId,
        ...taskData,
        progress_percentage: 0,
        is_completed: false,
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: projectId }] }) // Project check
        .mockResolvedValueOnce({ rows: [{ id: taskData.assigned_to }] }) // User check
        .mockResolvedValueOnce({ rows: [mockTask] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await createTask(projectId, taskData, userId);

      expect(result).toEqual(mockTask);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw ValidationError if name is empty', async () => {
      const invalidData = { ...taskData, name: '' };

      await expect(createTask(projectId, invalidData, userId)).rejects.toThrow(
        ValidationError
      );
      await expect(createTask(projectId, invalidData, userId)).rejects.toThrow(
        'Task name is required'
      );
    });

    it('should throw ValidationError if phase is empty', async () => {
      const invalidData = { ...taskData, phase: '' };

      await expect(createTask(projectId, invalidData, userId)).rejects.toThrow(
        ValidationError
      );
      await expect(createTask(projectId, invalidData, userId)).rejects.toThrow(
        'Task phase is required'
      );
    });

    it('should throw ValidationError if estimated_duration_days is not positive', async () => {
      const invalidData = { ...taskData, estimated_duration_days: 0 };

      await expect(createTask(projectId, invalidData, userId)).rejects.toThrow(
        ValidationError
      );
      await expect(createTask(projectId, invalidData, userId)).rejects.toThrow(
        'Estimated duration must be a positive number'
      );
    });

    it('should throw NotFoundError if project does not exist', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Project check - not found

      await expect(createTask(projectId, taskData, userId)).rejects.toThrow(
        NotFoundError
      );
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should throw ValidationError if assigned user does not exist', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: projectId }] }) // Project check
        .mockResolvedValueOnce({ rows: [] }); // User check - not found

      await expect(createTask(projectId, taskData, userId)).rejects.toThrow(
        ValidationError
      );
      await expect(createTask(projectId, taskData, userId)).rejects.toThrow(
        'Assigned user not found'
      );
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should create task without assigned_to', async () => {
      const dataWithoutAssignment = {
        name: 'Foundation Work',
        phase: 'Foundation',
        estimated_duration_days: 10,
      };

      const mockTask = {
        id: 'task-123',
        project_id: projectId,
        ...dataWithoutAssignment,
        assigned_to: null,
        created_by: userId,
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: projectId }] }) // Project check
        .mockResolvedValueOnce({ rows: [mockTask] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await createTask(projectId, dataWithoutAssignment, userId);

      expect(result.assigned_to).toBeNull();
    });
  });

  describe('updateTask', () => {
    const taskId = 'task-123';
    const userId = 'user-123';

    it('should update task with valid data', async () => {
      const updateData: UpdateTaskDTO = {
        name: 'Updated Foundation Work',
        phase: 'Foundation Phase 2',
      };

      const mockTask = {
        id: taskId,
        ...updateData,
        project_id: 'project-123',
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: taskId, project_id: 'project-123' }],
        }) // Task check
        .mockResolvedValueOnce({ rows: [mockTask] }) // UPDATE
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await updateTask(taskId, updateData, userId);

      expect(result).toEqual(mockTask);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw ValidationError if name is empty string', async () => {
      const invalidData = { name: '' };

      await expect(updateTask(taskId, invalidData, userId)).rejects.toThrow(
        ValidationError
      );
      await expect(updateTask(taskId, invalidData, userId)).rejects.toThrow(
        'Task name cannot be empty'
      );
    });

    it('should throw ValidationError if no fields to update', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: taskId, project_id: 'project-123' }],
        }); // Task check

      await expect(updateTask(taskId, {}, userId)).rejects.toThrow(
        ValidationError
      );
      await expect(updateTask(taskId, {}, userId)).rejects.toThrow(
        'No fields to update'
      );
    });

    it('should throw NotFoundError if task does not exist', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Task check - not found

      await expect(
        updateTask(taskId, { name: 'New Name' }, userId)
      ).rejects.toThrow(NotFoundError);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('deleteTask', () => {
    const taskId = 'task-123';
    const userId = 'user-123';

    it('should delete task successfully', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: taskId, project_id: 'project-123' }],
        }) // Task check
        .mockResolvedValueOnce({ rows: [] }) // DELETE
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await deleteTask(taskId, userId);

      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM tasks WHERE id = $1',
        [taskId]
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw NotFoundError if task does not exist', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Task check - not found

      await expect(deleteTask(taskId, userId)).rejects.toThrow(NotFoundError);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('getTask', () => {
    const taskId = 'task-123';
    const userId = 'user-123';

    it('should return task if user has access', async () => {
      const mockTask = {
        id: taskId,
        name: 'Foundation Work',
        project_id: 'project-123',
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockTask] });

      const result = await getTask(taskId, userId);

      expect(result).toEqual(mockTask);
    });

    it('should throw NotFoundError if task does not exist or no access', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(getTask(taskId, userId)).rejects.toThrow(NotFoundError);
      await expect(getTask(taskId, userId)).rejects.toThrow(
        'Task not found or access denied'
      );
    });
  });

  describe('listTasksByProject', () => {
    const projectId = 'project-123';
    const userId = 'user-123';

    it('should return all tasks for a project', async () => {
      const mockTasks = [
        { id: 'task-1', name: 'Task 1', project_id: projectId },
        { id: 'task-2', name: 'Task 2', project_id: projectId },
      ];

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: projectId }] }) // Project check
        .mockResolvedValueOnce({ rows: mockTasks }); // Tasks query

      const result = await listTasksByProject(projectId, userId);

      expect(result).toEqual(mockTasks);
      expect(result).toHaveLength(2);
    });

    it('should throw NotFoundError if project does not exist or no access', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(listTasksByProject(projectId, userId)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('addDependency', () => {
    const taskId = 'task-123';
    const dependsOnTaskId = 'task-456';
    const userId = 'user-123';

    it('should add dependency between tasks', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              task1_id: taskId,
              project1_id: 'project-123',
              task2_id: dependsOnTaskId,
              project2_id: 'project-123',
            },
          ],
        }) // Tasks check
        .mockResolvedValueOnce({ rows: [{ id: 'project-123' }] }) // Access check
        .mockResolvedValueOnce({ rows: [] }) // Existing dependency check
        .mockResolvedValueOnce({ rows: [] }) // Circular dependency check (no deps)
        .mockResolvedValueOnce({ rows: [] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await addDependency(taskId, dependsOnTaskId, userId);

      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw ValidationError if task depends on itself', async () => {
      await expect(addDependency(taskId, taskId, userId)).rejects.toThrow(
        ValidationError
      );
      await expect(addDependency(taskId, taskId, userId)).rejects.toThrow(
        'A task cannot depend on itself'
      );
    });

    it('should throw ValidationError if tasks are in different projects', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              task1_id: taskId,
              project1_id: 'project-123',
              task2_id: dependsOnTaskId,
              project2_id: 'project-456',
            },
          ],
        }); // Tasks check - different projects

      await expect(
        addDependency(taskId, dependsOnTaskId, userId)
      ).rejects.toThrow(ValidationError);
      await expect(
        addDependency(taskId, dependsOnTaskId, userId)
      ).rejects.toThrow('Tasks must belong to the same project');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should throw ValidationError if dependency already exists', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              task1_id: taskId,
              project1_id: 'project-123',
              task2_id: dependsOnTaskId,
              project2_id: 'project-123',
            },
          ],
        }) // Tasks check
        .mockResolvedValueOnce({ rows: [{ id: 'project-123' }] }) // Access check
        .mockResolvedValueOnce({ rows: [{ id: 'dep-123' }] }); // Existing dependency

      await expect(
        addDependency(taskId, dependsOnTaskId, userId)
      ).rejects.toThrow(ValidationError);
      await expect(
        addDependency(taskId, dependsOnTaskId, userId)
      ).rejects.toThrow('Dependency already exists');
    });
  });

  describe('removeDependency', () => {
    const taskId = 'task-123';
    const dependsOnTaskId = 'task-456';
    const userId = 'user-123';

    it('should remove dependency between tasks', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: 'dep-123', project_id: 'project-123' }],
        }) // Dependency check
        .mockResolvedValueOnce({ rows: [] }) // DELETE
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await removeDependency(taskId, dependsOnTaskId, userId);

      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw NotFoundError if dependency does not exist', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Dependency check - not found

      await expect(
        removeDependency(taskId, dependsOnTaskId, userId)
      ).rejects.toThrow(NotFoundError);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('getTaskDependencyTree', () => {
    const projectId = 'project-123';
    const userId = 'user-123';

    it('should return task tree with dependencies', async () => {
      const mockTasks = [
        { id: 'task-1', name: 'Task 1' },
        { id: 'task-2', name: 'Task 2' },
      ];

      const mockDependencies = [
        {
          id: 'dep-1',
          task_id: 'task-2',
          depends_on_task_id: 'task-1',
        },
      ];

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: projectId }] }) // Project check
        .mockResolvedValueOnce({ rows: mockTasks }) // Tasks query
        .mockResolvedValueOnce({ rows: mockDependencies }); // Dependencies query

      const result = await getTaskDependencyTree(projectId, userId);

      expect(result.tasks).toEqual(mockTasks);
      expect(result.dependencies).toEqual(mockDependencies);
    });

    it('should throw NotFoundError if project does not exist or no access', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(getTaskDependencyTree(projectId, userId)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('updateProgress', () => {
    const taskId = 'task-123';
    const userId = 'user-123';

    it('should update task progress successfully', async () => {
      const mockHistory = {
        id: 'history-123',
        task_id: taskId,
        progress_percentage: 50,
        notes: 'Halfway done',
        updated_by: userId,
        created_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: taskId, project_id: 'project-123', progress_percentage: 0 }],
        }) // Task check
        .mockResolvedValueOnce({ rows: [] }) // UPDATE tasks
        .mockResolvedValueOnce({ rows: [mockHistory] }) // INSERT history
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await updateProgress(taskId, 50, 'Halfway done', userId);

      expect(result).toEqual(mockHistory);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw ValidationError if progress is less than 0', async () => {
      await expect(updateProgress(taskId, -1, undefined, userId)).rejects.toThrow(
        ValidationError
      );
      await expect(updateProgress(taskId, -1, undefined, userId)).rejects.toThrow(
        'Progress percentage must be between 0 and 100'
      );
    });

    it('should throw ValidationError if progress is greater than 100', async () => {
      await expect(updateProgress(taskId, 101, undefined, userId)).rejects.toThrow(
        ValidationError
      );
    });

    it('should mark task as completed when progress is 100', async () => {
      const mockHistory = {
        id: 'history-123',
        task_id: taskId,
        progress_percentage: 100,
        updated_by: userId,
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: taskId, project_id: 'project-123', progress_percentage: 90 }],
        }) // Task check
        .mockResolvedValueOnce({ rows: [] }) // UPDATE tasks
        .mockResolvedValueOnce({ rows: [mockHistory] }) // INSERT history
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await updateProgress(taskId, 100, undefined, userId);

      // Verify UPDATE query includes is_completed = true
      const updateCall = mockClient.query.mock.calls.find(
        (call: any) => call[0] && call[0].includes('UPDATE tasks')
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[1]).toContain(100); // progress
      expect(updateCall[1]).toContain(true); // is_completed
    });

    it('should throw NotFoundError if task does not exist', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Task check - not found

      await expect(updateProgress(taskId, 50, undefined, userId)).rejects.toThrow(
        NotFoundError
      );
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('getProgressHistory', () => {
    const taskId = 'task-123';
    const userId = 'user-123';

    it('should return progress history in chronological order', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          task_id: taskId,
          progress_percentage: 25,
          created_at: new Date('2024-01-01'),
        },
        {
          id: 'history-2',
          task_id: taskId,
          progress_percentage: 50,
          created_at: new Date('2024-01-02'),
        },
      ];

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: taskId }] }) // Task check
        .mockResolvedValueOnce({ rows: mockHistory }); // History query

      const result = await getProgressHistory(taskId, userId);

      expect(result).toEqual(mockHistory);
      expect(result).toHaveLength(2);
    });

    it('should throw NotFoundError if task does not exist or no access', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(getProgressHistory(taskId, userId)).rejects.toThrow(
        NotFoundError
      );
    });
  });
});
