import { Pool } from 'pg';
import * as userService from './user.service';
import * as authService from './auth.service';
import { AuthorizationError } from '../utils/errors';

jest.mock('../config/database');
jest.mock('../utils/logger');
jest.mock('./auth.service');

describe('User Service', () => {
  let mockClient: any;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = { query: jest.fn(), release: jest.fn() };
    mockPool = require('../config/database').pool;
    mockPool.connect = jest.fn().mockResolvedValue(mockClient);
    (authService.hashPassword as jest.Mock).mockResolvedValue('hashed_password');
  });

  describe('createUser', () => {
    const adminUserId = 'admin-123';
    const validUserData: userService.CreateUserDTO = {
      email: 'newuser@example.com',
      password: 'password123',
      role: 'Team_Member',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should create a user with valid data', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ role: 'Admin' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{
          id: 'user-123', email: 'newuser@example.com', role: 'Team_Member',
          first_name: 'John', last_name: 'Doe', is_active: true,
          created_at: new Date(), updated_at: new Date()
        }] });

      const result = await userService.createUser(validUserData, adminUserId);
      expect(result.id).toBe('user-123');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw AuthorizationError when not admin', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ role: 'Team_Member' }] });
      await expect(userService.createUser(validUserData, 'non-admin')).rejects.toThrow(AuthorizationError);
    });

    it('should throw ValidationError for invalid email', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ role: 'Admin' }] });
      await expect(userService.createUser({ ...validUserData, email: 'invalid' }, adminUserId)).rejects.toThrow('Invalid email format');
    });
  });

  describe('updateUser', () => {
    it('should update a user successfully', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ role: 'Admin' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'user-123', email: 'user@example.com' }] })
        .mockResolvedValueOnce({ rows: [{
          id: 'user-123', email: 'user@example.com', role: 'Team_Member',
          first_name: 'Jane', last_name: 'Smith', is_active: true,
          created_at: new Date(), updated_at: new Date()
        }] });

      const result = await userService.updateUser('user-123', { firstName: 'Jane' }, 'admin-123');
      expect(result.firstName).toBe('Jane');
    });
  });

  describe('deleteUser', () => {
    it('should delete a user successfully', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ role: 'Admin' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'user-123', role: 'Team_Member' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await userService.deleteUser('user-123', 'admin-123');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('getUser', () => {
    it('should allow user to view own profile', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ role: 'Team_Member' }] })
        .mockResolvedValueOnce({ rows: [{
          id: 'user-123', email: 'user@example.com', role: 'Team_Member',
          first_name: 'John', last_name: 'Doe', is_active: true,
          created_at: new Date(), updated_at: new Date()
        }] });

      const result = await userService.getUser('user-123', 'user-123');
      expect(result.id).toBe('user-123');
    });
  });

  describe('listUsers', () => {
    it('should list all users for admin', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ role: 'Admin' }] })
        .mockResolvedValueOnce({ rows: [{
          id: 'user-1', email: 'user1@example.com', role: 'Admin',
          first_name: 'John', last_name: 'Doe', is_active: true,
          created_at: new Date(), updated_at: new Date()
        }] });

      const result = await userService.listUsers('admin-123');
      expect(result).toHaveLength(1);
    });
  });
});
