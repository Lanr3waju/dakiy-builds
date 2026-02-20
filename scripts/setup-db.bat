@echo off
REM Setup database script for DakiyBuilds (Windows)

echo [1/4] Checking PostgreSQL container...

REM Check if docker-compose is running
docker-compose ps | findstr "dakiybuilds-postgres" >nul
if errorlevel 1 (
    echo [ERROR] PostgreSQL container is not running
    echo Please run: docker-compose up -d
    exit /b 1
)

echo [OK] PostgreSQL container is running

REM Wait for PostgreSQL to be ready
echo [2/4] Waiting for PostgreSQL to be ready...
timeout /t 5 /nobreak >nul

REM Create database
echo [3/4] Creating database...
docker-compose exec -T postgres psql -U postgres -c "CREATE DATABASE dakiybuilds;" 2>nul
if errorlevel 1 (
    echo [INFO] Database might already exist, continuing...
) else (
    echo [OK] Database created successfully
)

REM Verify database exists
docker-compose exec -T postgres psql -U postgres -lqt | findstr "dakiybuilds" >nul
if errorlevel 1 (
    echo [ERROR] Database was not created successfully
    exit /b 1
)

echo [OK] Database verified

REM Run migrations
echo [4/4] Running database migrations...
cd packages\backend
call npm run migrate up

if errorlevel 1 (
    echo [ERROR] Migration failed
    exit /b 1
)

echo.
echo ========================================
echo [SUCCESS] Database setup complete!
echo ========================================
echo.
echo You can now run: npm run dev

