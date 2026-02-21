import { Pool } from 'pg';
import * as authService from './auth.service';
import { AuthenticationError, ValidationError, DatabaseError } from '../utils/errors';

// Mock dependencies
jest.mock('../config/database');
jest.mock('../utils/logger');

describe('Authentication Service', () => {
  let mockClient: any;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    // Mock pool
    mockPool = require('../config/database').pool;
    mockPool.connect = jest.fn().mockResolvedValue(mockClient);
  });

  describe('hashPassword', () => {
    it('should hash a valid password', async () => {
      const password = 'testPassword123';
      const hash = await authService.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should throw ValidationError for password shorter than 8 characters', async () => {
      await expect(authService.hashPassword('short')).rejects.toThrow(ValidationError);
      await expect(authService.hashPassword('short')).rejects.toThrow(
        'Password must be at least 8 characters long'
      );
    });

    it('should throw ValidationError for empty password', async () => {
      await expect(authService.hashPassword('')).rejects.toThrow(ValidationError);
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'testPassword123';
      const hash1 = await authService.hashPassword(password);
      const hash2 = await authService.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for matching password and hash', async () => {
      const password = 'testPassword123';
      const hash = await authService.hashPassword(password);
      const isValid = await authService.verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const password = 'testPassword123';
      const hash = await authService.hashPassword(password);
      const isValid = await authService.verifyPassword('wrongPassword', hash);

      expect(isValid).toBe(false);
    });

    it('should return false for invalid hash format', async () => {
      const isValid = await authService.verifyPassword('password', 'invalid-hash');
      expect(isValid).toBe(false);
    });
  });

  describe('login', () => {
    const validCredentials = {
      email: 'test@example.com',
      password: 'testPassword123',
    };

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz', // Mock hash
      role: 'Project_Manager',
      first_name: 'John',
      last_name: 'Doe',
      is_active: true,
    };

    const mockSession = {
      id: 'session-123',
      user_id: 'user-123',
      token: 'mock-token-123',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      created_at: new Date(),
      last_accessed_at: new Date(),
    };

    beforeEach(() => {
      // Reset the spy before each test
      jest.restoreAllMocks();
    });

    it('should successfully login with valid credentials', async () => {
      // Create a real hash for the password
      const realHash = await authService.hashPassword(validCredentials.password);
      const userWithRealHash = { ...mockUser, password_hash: realHash };

      mockClient.query
        .mockResolvedValueOnce({ rows: [userWithRealHash] }) // User query
        .mockResolvedValueOnce({ rows: [mockSession] }); // Session insert

      const result = await authService.login(validCredentials);

      expect(result).toHaveProperty('session');
      expect(result).toHaveProperty('user');
      expect(result.user.id).toBe(mockUser.id);
      expect(result.user.email).toBe(mockUser.email);
      expect(result.user.role).toBe(mockUser.role);
      expect(result.session.token).toBeDefined();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw ValidationError when email is missing', async () => {
      await expect(
        authService.login({ email: '', password: 'password123' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when password is missing', async () => {
      await expect(
        authService.login({ email: 'test@example.com', password: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid email format', async () => {
      await expect(
        authService.login({ email: 'invalid-email', password: 'password123' })
      ).rejects.toThrow(ValidationError);
      await expect(
        authService.login({ email: 'invalid-email', password: 'password123' })
      ).rejects.toThrow('Invalid email format');
    });

    it('should throw AuthenticationError when user does not exist', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No user found - first call
        .mockResolvedValueOnce({ rows: [] }); // No user found - second call

      await expect(authService.login(validCredentials)).rejects.toThrow(AuthenticationError);
      await expect(authService.login(validCredentials)).rejects.toThrow(
        'Invalid email or password'
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw AuthenticationError when user is inactive', async () => {
      const inactiveUser = { ...mockUser, is_active: false };
      mockClient.query
        .mockResolvedValueOnce({ rows: [inactiveUser] }) // First call
        .mockResolvedValueOnce({ rows: [inactiveUser] }); // Second call

      await expect(authService.login(validCredentials)).rejects.toThrow(AuthenticationError);
      await expect(authService.login(validCredentials)).rejects.toThrow('Account is inactive');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw AuthenticationError when password is incorrect', async () => {
      // Create a hash for a different password
      const wrongHash = await authService.hashPassword('differentPassword123');
      const userWithWrongHash = { ...mockUser, password_hash: wrongHash };
      
      mockClient.query
        .mockResolvedValueOnce({ rows: [userWithWrongHash] }) // First call
        .mockResolvedValueOnce({ rows: [userWithWrongHash] }); // Second call

      await expect(authService.login(validCredentials)).rejects.toThrow(AuthenticationError);
      await expect(authService.login(validCredentials)).rejects.toThrow(
        'Invalid email or password'
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should convert email to lowercase', async () => {
      // Create a real hash for the password
      const realHash = await authService.hashPassword('password123');
      const userWithRealHash = { ...mockUser, password_hash: realHash };

      mockClient.query
        .mockResolvedValueOnce({ rows: [userWithRealHash] })
        .mockResolvedValueOnce({ rows: [mockSession] });

      await authService.login({ email: 'TEST@EXAMPLE.COM', password: 'password123' });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        ['test@example.com']
      );
    });

    it('should create session with expiration date', async () => {
      // Create a real hash for the password
      const realHash = await authService.hashPassword(validCredentials.password);
      const userWithRealHash = { ...mockUser, password_hash: realHash };

      mockClient.query
        .mockResolvedValueOnce({ rows: [userWithRealHash] })
        .mockResolvedValueOnce({ rows: [mockSession] });

      const result = await authService.login(validCredentials);

      expect(result.session.expiresAt).toBeInstanceOf(Date);
      expect(result.session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should release client on database error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(authService.login(validCredentials)).rejects.toThrow();
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('validateSession', () => {
    const mockToken = 'valid-token-123';
    const mockSessionData = {
      id: 'session-123',
      user_id: 'user-123',
      token: mockToken,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      created_at: new Date(),
      last_accessed_at: new Date(),
      email: 'test@example.com',
      role: 'Project_Manager',
      first_name: 'John',
      last_name: 'Doe',
      is_active: true,
    };

    it('should validate a valid session token', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [mockSessionData] }) // Session query
        .mockResolvedValueOnce({ rows: [] }); // Update last_accessed_at

      const result = await authService.validateSession(mockToken);

      expect(result).toHaveProperty('session');
      expect(result).toHaveProperty('user');
      expect(result.session.token).toBe(mockToken);
      expect(result.user.email).toBe(mockSessionData.email);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw AuthenticationError for empty token', async () => {
      await expect(authService.validateSession('')).rejects.toThrow(AuthenticationError);
      await expect(authService.validateSession('')).rejects.toThrow(
        'Session token is required'
      );
    });

    it('should throw AuthenticationError for invalid token', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No session found - first call
        .mockResolvedValueOnce({ rows: [] }); // No session found - second call

      await expect(authService.validateSession('invalid-token')).rejects.toThrow(
        AuthenticationError
      );
      await expect(authService.validateSession('invalid-token')).rejects.toThrow(
        'Invalid session token'
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw AuthenticationError and delete expired session', async () => {
      const expiredSession = {
        ...mockSessionData,
        expires_at: new Date(Date.now() - 1000), // Expired
      };
      mockClient.query
        .mockResolvedValueOnce({ rows: [expiredSession] }) // Session query - first call
        .mockResolvedValueOnce({ rows: [] }) // Delete query - first call
        .mockResolvedValueOnce({ rows: [expiredSession] }) // Session query - second call
        .mockResolvedValueOnce({ rows: [] }); // Delete query - second call

      await expect(authService.validateSession(mockToken)).rejects.toThrow(AuthenticationError);
      await expect(authService.validateSession(mockToken)).rejects.toThrow(
        'Session has expired'
      );

      // Verify delete was called
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM sessions WHERE id = $1',
        [expiredSession.id]
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw AuthenticationError when user is inactive', async () => {
      const inactiveUserSession = { ...mockSessionData, is_active: false };
      mockClient.query
        .mockResolvedValueOnce({ rows: [inactiveUserSession] }) // First call
        .mockResolvedValueOnce({ rows: [inactiveUserSession] }); // Second call

      await expect(authService.validateSession(mockToken)).rejects.toThrow(AuthenticationError);
      await expect(authService.validateSession(mockToken)).rejects.toThrow('Account is inactive');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should update last_accessed_at timestamp', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [mockSessionData] })
        .mockResolvedValueOnce({ rows: [] });

      await authService.validateSession(mockToken);

      expect(mockClient.query).toHaveBeenCalledWith(
        'UPDATE sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1',
        [mockSessionData.id]
      );
    });

    it('should release client on database error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(authService.validateSession(mockToken)).rejects.toThrow();
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    const mockToken = 'valid-token-123';

    it('should successfully logout with valid token', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ user_id: 'user-123' }],
      });

      await authService.logout(mockToken);

      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM sessions WHERE token = $1 RETURNING user_id',
        [mockToken]
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw ValidationError for empty token', async () => {
      await expect(authService.logout('')).rejects.toThrow(ValidationError);
      await expect(authService.logout('')).rejects.toThrow('Session token is required');
    });

    it('should throw AuthenticationError for invalid token', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No session found - first call
        .mockResolvedValueOnce({ rows: [] }); // No session found - second call

      await expect(authService.logout('invalid-token')).rejects.toThrow(AuthenticationError);
      await expect(authService.logout('invalid-token')).rejects.toThrow('Invalid session token');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release client on database error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(authService.logout(mockToken)).rejects.toThrow();
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should clean up expired sessions and return count', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: '1' }, { id: '2' }, { id: '3' }],
        rowCount: 3,
      });

      const count = await authService.cleanupExpiredSessions();

      expect(count).toBe(3);
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP RETURNING id'
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return 0 when no expired sessions exist', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const count = await authService.cleanupExpiredSessions();

      expect(count).toBe(0);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release client on database error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(authService.cleanupExpiredSessions()).rejects.toThrow(DatabaseError);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('destroyAllUserSessions', () => {
    const userId = 'user-123';

    it('should destroy all sessions for a user and return count', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: '1' }, { id: '2' }],
        rowCount: 2,
      });

      const count = await authService.destroyAllUserSessions(userId);

      expect(count).toBe(2);
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM sessions WHERE user_id = $1 RETURNING id',
        [userId]
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return 0 when user has no sessions', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const count = await authService.destroyAllUserSessions(userId);

      expect(count).toBe(0);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw ValidationError for empty userId', async () => {
      await expect(authService.destroyAllUserSessions('')).rejects.toThrow(ValidationError);
      await expect(authService.destroyAllUserSessions('')).rejects.toThrow('User ID is required');
    });

    it('should release client on database error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(authService.destroyAllUserSessions(userId)).rejects.toThrow(DatabaseError);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
