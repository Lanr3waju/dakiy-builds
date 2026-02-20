# First Time Setup - Creating Your Admin User

Since DakiyBuilds uses role-based access control, only Admin users can create new accounts. This means you need an initial admin user to get started.

## Quick Setup

Run this command from the project root to create your first admin user:

```bash
cd packages/backend
npm run seed:admin
```

This will create an admin account with these credentials:

- **Email:** `admin@dakiybuilds.com`
- **Password:** `admin123`

## Login

1. Navigate to the login page at `http://localhost:5173` (or your frontend URL)
2. Enter the credentials above
3. You'll be logged in as an admin user

## Important Security Steps

⚠️ **After your first login, you should:**

1. Change the default admin password immediately
2. Create your own admin account with your email
3. (Optional) Delete or disable the default admin account

## Creating Additional Users

Once logged in as an admin:

1. Navigate to the User Management page (Admin only)
2. Click "Create User"
3. Fill in the user details and assign a role:
   - **Admin**: Full system access, can manage users
   - **Project_Manager**: Can create/manage projects and assign teams
   - **Team_Member**: Can view projects and update task progress

## Troubleshooting

If the seed script says "Admin user already exists":
- An admin user has already been created
- Try logging in with the credentials above
- If you forgot the password, you can reset it directly in the database or re-run migrations

If you get a database connection error:
- Make sure PostgreSQL is running (`docker-compose up -d`)
- Check your `.env` file has correct database credentials
- Verify migrations have been run (`npm run migrate`)
