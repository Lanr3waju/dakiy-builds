# Layout Components

This directory contains the base layout components for the DakiyBuilds platform.

## Components

### Layout

The main layout wrapper that combines Header, Sidebar, Footer, and main content area.

**Usage:**
```tsx
import Layout from '../components/layout/Layout';

function MyPage() {
  return (
    <Layout>
      <h1>Page Content</h1>
      <p>Your page content goes here</p>
    </Layout>
  );
}
```

### Header

Top navigation bar displaying the DakiyBuilds logo, user information, and logout button.

**Features:**
- Sticky positioning
- User name and role display
- Logout link
- Responsive design for mobile

### Sidebar

Left navigation panel with links to main application sections.

**Features:**
- Role-based navigation (Admin users see additional links)
- Active route highlighting
- Icon + label navigation items
- Responsive design (horizontal on mobile)

**Navigation Items:**
- Dashboard (all users)
- Projects (all users)
- Tasks (all users)
- Documents (all users)
- Timeline (all users)
- Users (Admin only)
- Audit Logs (Admin only)

### Footer

Bottom footer with copyright information and links.

**Features:**
- Copyright notice with current year
- Help, Privacy, and Terms links
- Responsive design

## Styling

Each component has its own CSS file in `src/styles/`:
- `Layout.css` - Main layout structure
- `Header.css` - Header styling
- `Sidebar.css` - Sidebar navigation styling
- `Footer.css` - Footer styling

## Mobile Responsiveness

All layout components are fully responsive:
- **Header**: Hides user info on mobile, shows only logout button
- **Sidebar**: Converts to horizontal scrolling navigation on mobile
- **Layout**: Stacks vertically on mobile devices
- **Footer**: Centers content and stacks links on mobile

## Role-Based Display

The Sidebar component uses the `useAuth` hook to determine which navigation items to display based on the user's role:

```tsx
const { user } = useAuth();
const canManageProjects = user?.role === 'Admin' || user?.role === 'Project_Manager';
const isAdmin = user?.role === 'Admin';
```

## Integration with React Router

The layout components integrate seamlessly with React Router:
- `NavLink` components in Sidebar automatically highlight active routes
- Header logo links to home page
- All navigation preserves authentication state
