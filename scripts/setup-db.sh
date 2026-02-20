#!/bin/bash

# Setup database script for DakiyBuilds

echo "🔧 Setting up DakiyBuilds database..."

# Check if docker-compose is running
if ! docker-compose ps | grep -q "dakiybuilds-postgres"; then
    echo "❌ PostgreSQL container is not running"
    echo "   Run: docker-compose up -d"
    exit 1
fi

echo "✅ PostgreSQL container is running"

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 3

# Check if database exists
DB_EXISTS=$(docker-compose exec -T postgres psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='dakiybuilds'")

if [ "$DB_EXISTS" = "1" ]; then
    echo "✅ Database 'dakiybuilds' already exists"
else
    echo "📦 Creating database 'dakiybuilds'..."
    docker-compose exec -T postgres psql -U postgres -c "CREATE DATABASE dakiybuilds;"
    echo "✅ Database created successfully"
fi

# Run migrations
echo "🔄 Running database migrations..."
cd packages/backend
npm run migrate up

echo "✅ Database setup complete!"
echo ""
echo "You can now run: npm run dev"
