# DakiyBuilds Setup Guide

This guide will help you set up the DakiyBuilds development environment.

## Quick Start with Docker (Recommended)

### 1. Install Docker

Make sure you have Docker and Docker Compose installed:
- [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
- [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
- [Docker for Linux](https://docs.docker.com/engine/install/)

### 2. Start Database Services

From the project root directory:

```bash
docker-compose up -d
```

This will start:
- PostgreSQL on port 5432
- Redis on port 6379

Check if services are running:
```bash
docker-compose ps
```

### 3. Run Database Migrations

```bash
cd packages/backend
npm run migrate up
```

### 4. Start Development Servers

From the project root:
```bash
npm run dev
```

The application will be available at:
- Backend API: http://localhost:3000
- Frontend: http://localhost:5173

### 5. Stop Services

When you're done:
```bash
docker-compose down
```

To remove all data:
```bash
docker-compose down -v
```

## Manual Setup (Without Docker)

### 1. Install PostgreSQL

#### Windows
Download and install from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)

#### Mac
```bash
brew install postgresql@15
brew services start postgresql@15
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Install Redis

#### Windows
Download from [Redis for Windows](https://github.com/microsoftarchive/redis/releases)

#### Mac
```bash
brew install redis
brew services start redis
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
```

### 3. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE dakiybuilds;

# Exit
\q
```

### 4. Configure Environment

The `.env` file has already been created in `packages/backend/.env` with default values.

If you used different credentials, update:
- `DB_PASSWORD` - your PostgreSQL password
- `REDIS_PASSWORD` - your Redis password (if set)

### 5. Run Migrations

```bash
cd packages/backend
npm run migrate up
```

### 6. Start Development

From the project root:
```bash
npm run dev
```

## Troubleshooting

### Database Connection Refused

**Error**: `ECONNREFUSED` when connecting to PostgreSQL

**Solutions**:
1. Make sure PostgreSQL is running:
   ```bash
   # Docker
   docker-compose ps
   
   # Mac
   brew services list
   
   # Linux
   sudo systemctl status postgresql
   ```

2. Check if port 5432 is available:
   ```bash
   # Windows
   netstat -an | findstr 5432
   
   # Mac/Linux
   lsof -i :5432
   ```

3. Verify database credentials in `.env` file

### Redis Connection Issues

**Error**: Cannot connect to Redis

**Solutions**:
1. Make sure Redis is running:
   ```bash
   # Docker
   docker-compose ps
   
   # Mac
   brew services list
   
   # Linux
   sudo systemctl status redis-server
   ```

2. Test Redis connection:
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

### Migration Errors

**Error**: Migration fails

**Solutions**:
1. Check database connection
2. Ensure database is empty or run:
   ```bash
   npm run migrate down
   npm run migrate up
   ```

### Port Already in Use

**Error**: Port 3000 or 5173 already in use

**Solutions**:
1. Change port in `.env` file:
   ```
   PORT=3001
   ```

2. Or kill the process using the port:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   
   # Mac/Linux
   lsof -ti:3000 | xargs kill -9
   ```

## Next Steps

After setup is complete:

1. **Create a test user** - You'll need to manually insert a user into the database or create a seed script
2. **Test the API** - Use the health endpoint: http://localhost:3000/health
3. **Access the frontend** - Open http://localhost:5173 in your browser

## Development Workflow

1. Start services: `docker-compose up -d` (or start PostgreSQL/Redis manually)
2. Run migrations: `cd packages/backend && npm run migrate up`
3. Start dev servers: `npm run dev` (from root)
4. Make changes and test
5. Run tests: `npm test`
6. Stop services: `docker-compose down`

## Useful Commands

```bash
# View logs
docker-compose logs -f

# View PostgreSQL logs
docker-compose logs -f postgres

# View Redis logs
docker-compose logs -f redis

# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d dakiybuilds

# Connect to Redis CLI
docker-compose exec redis redis-cli

# Reset database
cd packages/backend
npm run migrate down
npm run migrate up

# Run backend tests
cd packages/backend
npm test

# Run frontend tests
cd packages/frontend
npm test
```
