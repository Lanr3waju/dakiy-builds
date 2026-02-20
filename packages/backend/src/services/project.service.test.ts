import { pool } from '../config/database';
import {
  createProject,
  updateProject,
  deleteProject,
  getProject,
  listProjects,

  CreateProjectDTO,
  UpdateProjectDTO,
} from './project.service';
import {
  ValidationError,
  AuthorizationError,
  NotFoundError,

  DatabaseError,
} from '../utils/errors';

// Mock the database pool
jest.mock('../config/database');
jest.mock('../utils/logger');

describe('Project Service', () => {
  let mockClient: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  describe('createProject', () => {
    const validProjectData: CreateProjectDTO = {
      name: 'New Construction Project',
      description: 'Building a new office',
      location: 'New York, NY',
      budget: 500000,
      startDate: new Date('2024-01-01'),
      plannedCompletionDate: new Date('2024-12-31'),
    };

    const userId = 'user-123';

    it('should create a project successfully for Project_Manager', async () => {
      // Mock user role check
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ role: 'Project_Manager' }] }) // requireProjectCreationRole
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ // INSERT project
          rows: [{
            id: 'project-123',
            name: validProjectData.name,
            description: validProjectData.description,
            location: validProjectData.location,
            budget: validProjectData.budget,
            start_date: validProjectData.startDate,
            end_date: null,
            planned_completion_date: validProjectData.plannedCompletionDate,
            owner_id: userId,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // INSERT team member
        .mockResolvedValueOnce({ rows: [] }) // INSERT audit log
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await createProject(validProjectData, userId);

      expect(result).toMatchObject({
        id: 'project-123',
        name: validProjectData.name,
        location: validProjectData.location,
        ownerId: userId,
      });
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should create a project successfully for Admin', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ role: 'Admin' }] })
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            id: 'project-456',
            name: validProjectData.name,
            description: validProjectData.description,
            location: validProjectData.location,
            budget: validProjectData.budget,
            start_date: validProjectData.startDate,
            end_date: null,
            planned_completion_date: validProjectData.plannedCompletionDate,
            owner_id: userId,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await createProject(validProjectData, userId);

      expect(result.id).toBe('project-456');
    });

    it('should throw AuthorizationError for Team_Member', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ role: 'Team_Member' }] });

      await expect(createProject(validProjectData, userId)).rejects.toThrow(AuthorizationError);
    });

    it('should throw ValidationError for missing required fields', async () => {
      const invalidData = {
        name: '',
        location: 'New York',
        startDate: new Date(),
        plannedCompletionDate: new Date(),
      };

      await expect(createProject(invalidData, userId)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid date order', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ role: 'Admin' }] });

      const invalidData = {
        ...validProjectData,
        startDate: new Date('2024-12-31'),
        plannedCompletionDate: new Date('2024-01-01'),
      };

      await expect(createProject(invalidData, userId)).rejects.toThrow(ValidationError);
      expect(mockClient.query).toHaveBeenCalledWith('SELECT role FROM users WHERE id = $1', [userId]);
    });

    it('should throw ValidationError for negative budget', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ role: 'Admin' }] });

      const invalidData = {
        ...validProjectData,
        budget: -1000,
      };

      await expect(createProject(invalidData, userId)).rejects.toThrow(ValidationError);
    });

    it('should rollback transaction on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ role: 'Admin' }] })
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Database error'));

      await expect(createProject(validProjectData, userId)).rejects.toThrow(DatabaseError);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('updateProject', () => {
    const projectId = 'project-123';
    const userId = 'user-123';

    it('should update project successfully', async () => {
      const updateData: UpdateProjectDTO = {
        name: 'Updated Project Name',
        budget: 600000,
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ // Check project exists
          rows: [{
            id: projectId,
            name: 'Old Name',
            start_date: new Date('2024-01-01'),
            end_date: null,
            planned_completion_date: new Date('2024-12-31'),
          }],
        })
        .mockResolvedValueOnce({ rows: [{ role: 'Admin' }] }) // hasProjectAccess - user role
        .mockResolvedValueOnce({ // UPDATE project
          rows: [{
            id: projectId,
            name: updateData.name,
            description: 'Test description',
            location: 'New York',
            budget: updateData.budget,
            start_date: new Date('2024-01-01'),
            end_date: null,
            planned_completion_date: new Date('2024-12-31'),
            owner_id: userId,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // INSERT audit log
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await updateProject(projectId, updateData, userId);

      expect(result.name).toBe(updateData.name);
      expect(result.budget).toBe(updateData.budget);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw NotFoundError for non-existent project', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Check project exists

      await expect(updateProject(projectId, { name: 'New Name' }, userId)).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError for user without access', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ // Check project exists
          rows: [{
            id: projectId,
            name: 'Project',
            start_date: new Date(),
            end_date: null,
            planned_completion_date: new Date(),
          }],
        })
        .mockResolvedValueOnce({ rows: [{ role: 'Team_Member' }] }) // hasProjectAccess - user role
        .mockResolvedValueOnce({ rows: [] }) // hasProjectAccess - owner check
        .mockResolvedValueOnce({ rows: [] }); // hasProjectAccess - team member check

      await expect(updateProject(projectId, { name: 'New Name' }, userId)).rejects.toThrow(AuthorizationError);
    });

    it('should throw ValidationError for empty update data', async () => {
      await expect(updateProject(projectId, {}, userId)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid date order', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            id: projectId,
            name: 'Project',
            start_date: new Date('2024-01-01'),
            end_date: null,
            planned_completion_date: new Date('2024-12-31'),
          }],
        })
        .mockResolvedValueOnce({ rows: [{ role: 'Admin' }] });

      const invalidUpdate = {
        startDate: new Date('2024-12-31'),
        plannedCompletionDate: new Date('2024-01-01'),
      };

      await expect(updateProject(projectId, invalidUpdate, userId)).rejects.toThrow(ValidationError);
    });
  });

  describe('deleteProject', () => {
    const projectId = 'project-123';
    const userId = 'user-123';

    it('should delete project successfully', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: projectId, name: 'Test Project' }] }) // Check exists
        .mockResolvedValueOnce({ rows: [{ role: 'Admin' }] }) // hasProjectAccess - user role
        .mockResolvedValueOnce({ rows: [] }) // INSERT audit log
        .mockResolvedValueOnce({ rows: [] }) // DELETE project
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await deleteProject(projectId, userId);

      expect(mockClient.query).toHaveBeenCalledWith('DELETE FROM projects WHERE id = $1', [projectId]);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw NotFoundError for non-existent project', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Check exists

      await expect(deleteProject(projectId, userId)).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError for user without access', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: projectId, name: 'Test' }] }) // Check exists
        .mockResolvedValueOnce({ rows: [{ role: 'Team_Member' }] }) // hasProjectAccess - user role
        .mockResolvedValueOnce({ rows: [] }) // hasProjectAccess - owner check
        .mockResolvedValueOnce({ rows: [] }); // hasProjectAccess - team member check

      await expect(deleteProject(projectId, userId)).rejects.toThrow(AuthorizationError);
    });
  });

  describe('getProject', () => {
    const projectId = 'project-123';
    const userId = 'user-123';

    it('should get project successfully for authorized user', async () => {
      const projectData = {
        id: projectId,
        name: 'Test Project',
        description: 'Description',
        location: 'New York',
        budget: 500000,
        start_date: new Date('2024-01-01'),
        end_date: null,
        planned_completion_date: new Date('2024-12-31'),
        owner_id: userId,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [{ role: 'Admin' }] }) // hasProjectAccess - user role
        .mockResolvedValueOnce({ rows: [projectData] }); // Get project

      const result = await getProject(projectId, userId);

      expect(result.id).toBe(projectId);
      expect(result.name).toBe('Test Project');
    });

    it('should throw AuthorizationError for user without access', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ role: 'Team_Member' }] }) // hasProjectAccess - user role
        .mockResolvedValueOnce({ rows: [] }) // hasProjectAccess - owner check
        .mockResolvedValueOnce({ rows: [] }); // hasProjectAccess - team member check

      await expect(getProject(projectId, userId)).rejects.toThrow(AuthorizationError);
    });

    it('should throw NotFoundError for non-existent project', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ role: 'Admin' }] }) // hasProjectAccess - user role
        .mockResolvedValueOnce({ rows: [] }); // Get project

      await expect(getProject(projectId, userId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('listProjects', () => {
    const userId = 'user-123';

    it('should list all projects for Admin', async () => {
      const projects = [
        {
          id: 'project-1',
          name: 'Project 1',
          description: 'Desc 1',
          location: 'NY',
          budget: 100000,
          start_date: new Date('2024-01-01'),
          end_date: null,
          planned_completion_date: new Date('2024-12-31'),
          owner_id: 'owner-1',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'project-2',
          name: 'Project 2',
          description: 'Desc 2',
          location: 'LA',
          budget: 200000,
          start_date: new Date('2024-02-01'),
          end_date: null,
          planned_completion_date: new Date('2024-11-30'),
          owner_id: 'owner-2',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [{ role: 'Admin' }] }) // Get user role
        .mockResolvedValueOnce({ rows: projects }); // Get projects

      const result = await listProjects(userId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('project-1');
      expect(result[1].id).toBe('project-2');
    });

    it('should list only accessible projects for non-Admin', async () => {
      const projects = [
        {
          id: 'project-1',
          name: 'Project 1',
          description: 'Desc 1',
          location: 'NY',
          budget: 100000,
          start_date: new Date('2024-01-01'),
          end_date: null,
          planned_completion_date: new Date('2024-12-31'),
          owner_id: userId,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [{ role: 'Project_Manager' }] }) // Get user role
        .mockResolvedValueOnce({ rows: projects }); // Get projects

      const result = await listProjects(userId);

      expect(result).toHaveLength(1);
      expect(result[0].ownerId).toBe(userId);
    });

    it('should apply filters correctly', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ role: 'Admin' }] })
        .mockResolvedValueOnce({ rows: [] });

      const filters = {
        isActive: true,
        startDateFrom: new Date('2024-01-01'),
        startDateTo: new Date('2024-12-31'),
      };

      await listProjects(userId, filters);

      // Verify query was called with filter parameters
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        expect.arrayContaining([true, filters.startDateFrom, filters.startDateTo])
      );
    });

    it('should throw NotFoundError for non-existent user', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // Get user role

      await expect(listProjects(userId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('assignTeamMember', () => {
    const projectId = 'project-123';
    const targetUserId = 'user-456';
    const assignedBy = 'user-123';
    const role = 'Member';

    beforeEach(() => {
      // Import the function for testing
      jest.isolateModules(() => {
        require('./project.service');
      });
    });

    it('should assign team member successfully', async () => {
      const { assignTeamMember } = require('./project.service');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: projectId, name: 'Test Project' }] }) // Check project exists
        .mockResolvedValueOnce({ rows: [{ id: targetUserId }] }) // Check user exists
        .mockResolvedValueOnce({ rows: [{ role: 'Admin' }] }) // hasProjectAccess - user role
        .mockResolvedValueOnce({ rows: [] }) // Check existing assignment
        .mockResolvedValueOnce({ rows: [] }) // INSERT team member
        .mockResolvedValueOnce({ rows: [] }) // INSERT audit log
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await assignTeamMember(projectId, targetUserId, role, assignedBy);

      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO project_team_members (project_id, user_id, role, assigned_by)\n       VALUES ($1, $2, $3, $4)',
        [projectId, targetUserId, role, assignedBy]
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw ValidationError for invalid role', async () => {
      const { assignTeamMember } = require('./project.service');

      await expect(
        assignTeamMember(projectId, targetUserId, 'InvalidRole' as any, assignedBy)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent project', async () => {
      const { assignTeamMember } = require('./project.service');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Check project exists

      await expect(
        assignTeamMember(projectId, targetUserId, role, assignedBy)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError for non-existent user', async () => {
      const { assignTeamMember } = require('./project.service');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: projectId, name: 'Test' }] }) // Check project exists
        .mockResolvedValueOnce({ rows: [] }); // Check user exists

      await expect(
        assignTeamMember(projectId, targetUserId, role, assignedBy)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError for user without access', async () => {
      const { assignTeamMember } = require('./project.service');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: projectId, name: 'Test' }] }) // Check project exists
        .mockResolvedValueOnce({ rows: [{ id: targetUserId }] }) // Check user exists
        .mockResolvedValueOnce({ rows: [{ role: 'Team_Member' }] }) // hasProjectAccess - user role
        .mockResolvedValueOnce({ rows: [] }) // hasProjectAccess - owner check
        .mockResolvedValueOnce({ rows: [] }); // hasProjectAccess - team member check

      await expect(
        assignTeamMember(projectId, targetUserId, role, assignedBy)
      ).rejects.toThrow(AuthorizationError);
    });

    it('should throw ConflictError for duplicate assignment', async () => {
      const { assignTeamMember } = require('./project.service');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: projectId, name: 'Test' }] }) // Check project exists
        .mockResolvedValueOnce({ rows: [{ id: targetUserId }] }) // Check user exists
        .mockResolvedValueOnce({ rows: [{ role: 'Admin' }] }) // hasProjectAccess - user role
        .mockResolvedValueOnce({ rows: [{ id: 'assignment-123' }] }); // Check existing assignment

      await expect(
        assignTeamMember(projectId, targetUserId, role, assignedBy)
      ).rejects.toThrow('User is already assigned to this project');
    });

    it('should rollback transaction on error', async () => {
      const { assignTeamMember } = require('./project.service');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: projectId, name: 'Test' }] }) // Check project exists
        .mockResolvedValueOnce({ rows: [{ id: targetUserId }] }) // Check user exists
        .mockResolvedValueOnce({ rows: [{ role: 'Admin' }] }) // hasProjectAccess - user role
        .mockResolvedValueOnce({ rows: [] }) // Check existing assignment
        .mockRejectedValueOnce(new Error('Database error')); // INSERT fails

      await expect(
        assignTeamMember(projectId, targetUserId, role, assignedBy)
      ).rejects.toThrow(DatabaseError);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('removeTeamMember', () => {
    const projectId = 'project-123';
    const targetUserId = 'user-456';
    const removedBy = 'user-123';

    beforeEach(() => {
      jest.isolateModules(() => {
        require('./project.service');
      });
    });

    it('should remove team member successfully', async () => {
      const { removeTeamMember } = require('./project.service');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: projectId, name: 'Test Project' }] }) // Check project exists
        .mockResolvedValueOnce({ rows: [{ role: 'Admin' }] }) // hasProjectAccess - user role
        .mockResolvedValueOnce({ rows: [{ id: 'assignment-123', role: 'Member' }] }) // Check assignment exists
        .mockResolvedValueOnce({ rows: [] }) // DELETE team member
        .mockResolvedValueOnce({ rows: [] }) // INSERT audit log
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await removeTeamMember(projectId, targetUserId, removedBy);

      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM project_team_members WHERE project_id = $1 AND user_id = $2',
        [projectId, targetUserId]
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw NotFoundError for non-existent project', async () => {
      const { removeTeamMember } = require('./project.service');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Check project exists

      await expect(
        removeTeamMember(projectId, targetUserId, removedBy)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError for user without access', async () => {
      const { removeTeamMember } = require('./project.service');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: projectId, name: 'Test' }] }) // Check project exists
        .mockResolvedValueOnce({ rows: [{ role: 'Team_Member' }] }) // hasProjectAccess - user role
        .mockResolvedValueOnce({ rows: [] }) // hasProjectAccess - owner check
        .mockResolvedValueOnce({ rows: [] }); // hasProjectAccess - team member check

      await expect(
        removeTeamMember(projectId, targetUserId, removedBy)
      ).rejects.toThrow(AuthorizationError);
    });

    it('should throw NotFoundError for non-existent assignment', async () => {
      const { removeTeamMember } = require('./project.service');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: projectId, name: 'Test' }] }) // Check project exists
        .mockResolvedValueOnce({ rows: [{ role: 'Admin' }] }) // hasProjectAccess - user role
        .mockResolvedValueOnce({ rows: [] }); // Check assignment exists

      await expect(
        removeTeamMember(projectId, targetUserId, removedBy)
      ).rejects.toThrow(NotFoundError);
    });

    it('should rollback transaction on error', async () => {
      const { removeTeamMember } = require('./project.service');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: projectId, name: 'Test' }] }) // Check project exists
        .mockResolvedValueOnce({ rows: [{ role: 'Admin' }] }) // hasProjectAccess - user role
        .mockResolvedValueOnce({ rows: [{ id: 'assignment-123', role: 'Member' }] }) // Check assignment exists
        .mockRejectedValueOnce(new Error('Database error')); // DELETE fails

      await expect(
        removeTeamMember(projectId, targetUserId, removedBy)
      ).rejects.toThrow(DatabaseError);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});
