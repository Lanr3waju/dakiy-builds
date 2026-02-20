import { Response, NextFunction } from 'express';
import {
  authenticate,
  requireRole,
  requireAdmin,
  requireProjectManager,
  requireAuthenticated,
  optionalAuthenticate,
  AuthenticatedRequest,
} from './auth.middleware';
import * as authService from '../services/auth.service';
import { AuthenticationError } from '../utils/errors';
import { UserRole } from '../types';

// Mock the auth service
jest.mock('../services/auth.service');
const mockValidateSession = authService.validateSession as jest.MockedFunction<
  typeof authService.validateSession
>;

// Mock logger
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Authentication Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      cookies: {},
      path: '/test',
      method: 'GET',
    };
    mockResponse = {};
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    const mockAuthResult = {
      session: {
        id: 'session-123',
        userId: 'user-123',
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      },
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: 'admin' as UserRole,
        firstName: 'Test',
        lastName: 'User',
      },
    };

    it('should authenticate with valid Bearer token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };
      mockValidateSession.mockResolvedValue(mockAuthResult);

      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockValidateSession).toHaveBeenCalledWith('valid-token');
      expect(mockRequest.user).toEqual(mockAuthResult.user);
      expect(mockRequest.session).toEqual({
        id: mockAuthResult.session.id,
        token: mockAuthResult.session.token,
        expiresAt: mockAuthResult.session.expiresAt,
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should authenticate with valid cookie token', async () => {
      mockRequest.cookies = {
        session_token: 'cookie-token',
      };
      mockValidateSession.mockResolvedValue(mockAuthResult);

      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockValidateSession).toHaveBeenCalledWith('cookie-token');
      expect(mockRequest.user).toEqual(mockAuthResult.user);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should prefer Bearer token over cookie', async () => {
      mockRequest.headers = {
        authorization: 'Bearer bearer-token',
      };
      mockRequest.cookies = {
        session_token: 'cookie-token',
      };
      mockValidateSession.mockResolvedValue(mockAuthResult);

      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockValidateSession).toHaveBeenCalledWith('bearer-token');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should fail when no token is provided', async () => {
      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockValidateSession).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Authentication token is required',
          statusCode: 401,
        })
      );
    });

    it('should fail when session validation fails', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };
      mockValidateSession.mockRejectedValue(
        new AuthenticationError('Invalid session token')
      );

      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid session token',
          statusCode: 401,
        })
      );
    });

    it('should fail when session is expired', async () => {
      mockRequest.headers = {
        authorization: 'Bearer expired-token',
      };
      mockValidateSession.mockRejectedValue(
        new AuthenticationError('Session has expired')
      );

      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Session has expired',
          statusCode: 401,
        })
      );
    });

    it('should handle unexpected errors gracefully', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };
      mockValidateSession.mockRejectedValue(new Error('Database error'));

      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Authentication failed',
          statusCode: 401,
        })
      );
    });
  });

  describe('requireRole', () => {
    beforeEach(() => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        role: UserRole.PROJECT_MANAGER,
        firstName: 'Test',
        lastName: 'User',
      };
    });

    it('should allow access when user has required role', () => {
      const middleware = requireRole(UserRole.PROJECT_MANAGER);

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow access when user has one of multiple allowed roles', () => {
      const middleware = requireRole(UserRole.ADMIN, UserRole.PROJECT_MANAGER);

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access when user does not have required role', () => {
      const middleware = requireRole(UserRole.ADMIN);

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Access denied. Required role: admin',
          statusCode: 403,
        })
      );
    });

    it('should deny access when user is not authenticated', () => {
      mockRequest.user = undefined;
      const middleware = requireRole(UserRole.PROJECT_MANAGER);

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not authenticated',
          statusCode: 401,
        })
      );
    });

    it('should handle Team_Member role correctly', () => {
      mockRequest.user!.role = UserRole.TEAM_MEMBER;
      const middleware = requireRole(UserRole.TEAM_MEMBER);

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requireAdmin', () => {
    it('should allow access for Admin users', () => {
      mockRequest.user = {
        id: 'admin-123',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
        firstName: 'Admin',
        lastName: 'User',
      };

      requireAdmin(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access for Project_Manager users', () => {
      mockRequest.user = {
        id: 'pm-123',
        email: 'pm@example.com',
        role: UserRole.PROJECT_MANAGER,
        firstName: 'PM',
        lastName: 'User',
      };

      requireAdmin(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
        })
      );
    });

    it('should deny access for Team_Member users', () => {
      mockRequest.user = {
        id: 'member-123',
        email: 'member@example.com',
        role: UserRole.TEAM_MEMBER,
        firstName: 'Member',
        lastName: 'User',
      };

      requireAdmin(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
        })
      );
    });
  });

  describe('requireProjectManager', () => {
    it('should allow access for Admin users', () => {
      mockRequest.user = {
        id: 'admin-123',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
        firstName: 'Admin',
        lastName: 'User',
      };

      requireProjectManager(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow access for Project_Manager users', () => {
      mockRequest.user = {
        id: 'pm-123',
        email: 'pm@example.com',
        role: UserRole.PROJECT_MANAGER,
        firstName: 'PM',
        lastName: 'User',
      };

      requireProjectManager(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access for Team_Member users', () => {
      mockRequest.user = {
        id: 'member-123',
        email: 'member@example.com',
        role: UserRole.TEAM_MEMBER,
        firstName: 'Member',
        lastName: 'User',
      };

      requireProjectManager(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
        })
      );
    });
  });

  describe('requireAuthenticated', () => {
    it('should allow access for Admin users', () => {
      mockRequest.user = {
        id: 'admin-123',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
        firstName: 'Admin',
        lastName: 'User',
      };

      requireAuthenticated(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow access for Project_Manager users', () => {
      mockRequest.user = {
        id: 'pm-123',
        email: 'pm@example.com',
        role: UserRole.PROJECT_MANAGER,
        firstName: 'PM',
        lastName: 'User',
      };

      requireAuthenticated(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow access for Team_Member users', () => {
      mockRequest.user = {
        id: 'member-123',
        email: 'member@example.com',
        role: UserRole.TEAM_MEMBER,
        firstName: 'Member',
        lastName: 'User',
      };

      requireAuthenticated(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access for unauthenticated users', () => {
      mockRequest.user = undefined;

      requireAuthenticated(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
        })
      );
    });
  });

  describe('optionalAuthenticate', () => {
    const mockAuthResult = {
      session: {
        id: 'session-123',
        userId: 'user-123',
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      },
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: 'admin' as UserRole,
        firstName: 'Test',
        lastName: 'User',
      },
    };

    it('should authenticate when valid token is provided', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };
      mockValidateSession.mockResolvedValue(mockAuthResult);

      await optionalAuthenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockValidateSession).toHaveBeenCalledWith('valid-token');
      expect(mockRequest.user).toEqual(mockAuthResult.user);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without authentication when no token is provided', async () => {
      await optionalAuthenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockValidateSession).not.toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without authentication when token is invalid', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };
      mockValidateSession.mockRejectedValue(
        new AuthenticationError('Invalid session token')
      );

      await optionalAuthenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without authentication on unexpected errors', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };
      mockValidateSession.mockRejectedValue(new Error('Database error'));

      await optionalAuthenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('Session Expiration Validation', () => {
    it('should reject expired sessions in authenticate middleware', async () => {
      mockRequest.headers = {
        authorization: 'Bearer expired-token',
      };
      mockValidateSession.mockRejectedValue(
        new AuthenticationError('Session has expired')
      );

      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Session has expired',
          statusCode: 401,
        })
      );
      expect(mockRequest.user).toBeUndefined();
    });

    it('should validate session expiration through auth service', async () => {
      // Mock expired session scenario

      mockRequest.headers = {
        authorization: 'Bearer expired-token',
      };
      
      // The auth service should throw an error for expired sessions
      mockValidateSession.mockRejectedValue(
        new AuthenticationError('Session has expired')
      );

      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Session has expired',
          statusCode: 401,
        })
      );
    });
  });

  describe('Role-Based Access Control', () => {
    it('should enforce Admin-only access', () => {
      // Admin should pass
      mockRequest.user = {
        id: 'admin-123',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
        firstName: 'Admin',
        lastName: 'User',
      };

      requireAdmin(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
      jest.clearAllMocks();

      // Project Manager should fail
      mockRequest.user.role = UserRole.PROJECT_MANAGER;
      requireAdmin(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
        })
      );
    });

    it('should enforce Project Manager or Admin access', () => {
      // Admin should pass
      mockRequest.user = {
        id: 'admin-123',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
        firstName: 'Admin',
        lastName: 'User',
      };

      requireProjectManager(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
      jest.clearAllMocks();

      // Project Manager should pass
      mockRequest.user.role = UserRole.PROJECT_MANAGER;
      requireProjectManager(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
      jest.clearAllMocks();

      // Team Member should fail
      mockRequest.user.role = UserRole.TEAM_MEMBER;
      requireProjectManager(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
        })
      );
    });

    it('should allow all authenticated users with requireAuthenticated', () => {
      const roles = [UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.TEAM_MEMBER];

      roles.forEach((role) => {
        jest.clearAllMocks();
        mockRequest.user = {
          id: 'user-123',
          email: 'user@example.com',
          role,
          firstName: 'Test',
          lastName: 'User',
        };

        requireAuthenticated(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledWith();
      });
    });
  });
});
