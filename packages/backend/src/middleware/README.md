# Authorization Middleware

This directory contains middleware for authentication and authorization in the DakiyBuilds platform.

## Overview

The authorization middleware provides:
- Session-based authentication
- Role-based access control (RBAC)
- Session expiration validation
- User information attachment to requests

## Middleware Components

### `authenticate`

Validates session tokens and attaches user information to the request object.

**Usage:**
```typescript
import { authenticate } from './middleware/auth.middleware';

app.get('/api/protected', authenticate, (req, res) => {
  // req.user and req.session are now available
  res.json({ user: req.user });
});
```

**Token Sources:**
- Authorization header: `Bearer <token>`
- Cookie: `session_token`

**Throws:**
- `AuthenticationError` (401) if token is missing, invalid, or expired

### `requireRole`

Factory function that creates middleware to check if the authenticated user has one of the specified roles.

**Usage:**
```typescript
import { requireRole } from './middleware/auth.middleware';
import { UserRole } from '../types';

// Single role
app.post('/api/admin/users', 
  authenticate, 
  requireRole(UserRole.ADMIN), 
  createUserHandler
);

// Multiple roles
app.post('/api/projects', 
  authenticate, 
  requireRole(UserRole.ADMIN, UserRole.PROJECT_MANAGER), 
  createProjectHandler
);
```

**Throws:**
- `AuthenticationError` (401) if user is not authenticated
- `AuthorizationError` (403) if user doesn't have required role

### Convenience Middleware

#### `requireAdmin`

Allows only Admin users.

```typescript
import { authenticate, requireAdmin } from './middleware/auth.middleware';

app.delete('/api/users/:id', authenticate, requireAdmin, deleteUserHandler);
```

#### `requireProjectManager`

Allows Admin and Project_Manager users.

```typescript
import { authenticate, requireProjectManager } from './middleware/auth.middleware';

app.post('/api/projects', authenticate, requireProjectManager, createProjectHandler);
```

#### `requireAuthenticated`

Allows any authenticated user (Admin, Project_Manager, or Team_Member).

```typescript
import { authenticate, requireAuthenticated } from './middleware/auth.middleware';

app.get('/api/dashboard', authenticate, requireAuthenticated, getDashboardHandler);
```

### `optionalAuthenticate`

Attempts to authenticate but doesn't fail if no token is provided. Useful for routes that have different behavior for authenticated vs anonymous users.

**Usage:**
```typescript
import { optionalAuthenticate } from './middleware/auth.middleware';

app.get('/api/public/projects', optionalAuthenticate, (req, res) => {
  if (req.user) {
    // Show user-specific projects
  } else {
    // Show public projects only
  }
});
```

## User Roles

The platform supports three user roles:

- **Admin**: Full system access, including user management
- **Project_Manager**: Can create/manage projects and assign team members
- **Team_Member**: Can view projects and update task progress

## Request Extensions

After successful authentication, the following properties are added to the request object:

```typescript
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    firstName: string;
    lastName: string;
  };
  session?: {
    id: string;
    token: string;
    expiresAt: Date;
  };
}
```

## Complete Example

```typescript
import express from 'express';
import { 
  authenticate, 
  requireAdmin, 
  requireProjectManager,
  requireAuthenticated 
} from './middleware/auth.middleware';

const app = express();

// Public route - no authentication
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Authenticated route - any role
app.get('/api/profile', authenticate, requireAuthenticated, (req, res) => {
  res.json({ user: req.user });
});

// Project Manager or Admin only
app.post('/api/projects', authenticate, requireProjectManager, (req, res) => {
  // Create project logic
  res.json({ message: 'Project created' });
});

// Admin only
app.post('/api/users', authenticate, requireAdmin, (req, res) => {
  // Create user logic
  res.json({ message: 'User created' });
});
```

## Session Management

Sessions are validated on each request through the `authenticate` middleware:

1. Token is extracted from Authorization header or cookies
2. Session is validated against the database
3. Session expiration is checked
4. User account status is verified
5. Last accessed time is updated

If any validation fails, an `AuthenticationError` is thrown.

## Error Handling

The middleware throws specific error types that should be handled by the error handler middleware:

- `AuthenticationError` (401): Invalid or missing credentials
- `AuthorizationError` (403): Insufficient permissions

Example error handler:

```typescript
import { errorHandler } from './middleware/errorHandler';

app.use(errorHandler);
```

## Testing

Comprehensive unit tests are available in `auth.middleware.test.ts`. Run tests with:

```bash
npm test
```

## Security Considerations

1. **Session Expiration**: Sessions expire after 24 hours (configurable in auth service)
2. **Token Security**: Tokens are 32-byte random hex strings
3. **Password Hashing**: Passwords are hashed with bcrypt (10 rounds)
4. **Session Cleanup**: Expired sessions are automatically cleaned up
5. **Account Status**: Inactive accounts cannot authenticate

## Requirements Validated

This middleware validates the following requirements:

- **1.3**: Authorization enforcement for all actions
- **1.4**: Admin role with full system access
- **1.5**: Project_Manager role with project management access
- **1.6**: Team_Member role with limited access
- **1.7**: Session expiration validation
