# Authentication Context

This directory contains the authentication context for the DakiyBuilds platform.

## AuthContext

The `AuthContext` provides authentication state and methods throughout the application.

### Features

- User session management
- Login/logout functionality
- Automatic token handling
- Session persistence with localStorage
- Automatic redirect on 401 errors
- Loading and error states

### Usage

```tsx
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { user, login, logout, loading, error } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {user ? (
        <>
          <p>Welcome, {user.name}!</p>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <button onClick={() => login(email, password)}>Login</button>
      )}
    </div>
  );
}
```

### API Integration

The AuthContext integrates with the following backend endpoints:

- `POST /api/auth/login` - Authenticate user and create session
- `POST /api/auth/logout` - Destroy session
- `GET /api/auth/me` - Get current user info

### Token Storage

Authentication tokens are stored in `localStorage` and automatically included in all API requests via the axios interceptor in `lib/api.ts`.

### Session Expiration

When a session expires (401 response), the user is automatically redirected to the login page and the token is removed from localStorage.

## ProtectedRoute Component

The `ProtectedRoute` component wraps routes that require authentication.

### Usage

```tsx
import ProtectedRoute from '../components/ProtectedRoute';

<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  }
/>
```

### Role-Based Access Control

You can also restrict routes by role:

```tsx
<ProtectedRoute requiredRole="Admin">
  <AdminPanel />
</ProtectedRoute>
```

Role hierarchy:
- Admin (level 3) - Full access
- Project_Manager (level 2) - Can manage projects
- Team_Member (level 1) - Can view and update tasks

Users with higher role levels can access routes requiring lower levels.
