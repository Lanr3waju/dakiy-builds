# DakiyBuilds Platform

AI-powered construction project management platform for small to medium construction firms.

## Project Structure

This is a monorepo containing:

- `packages/backend` - Node.js/Express REST API server
- `packages/frontend` - React web application

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL >= 14
- Redis >= 6
- AWS S3 account (or S3-compatible storage)

## Getting Started

### Quick Setup (5 minutes)

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start database services with Docker**
   ```bash
   docker-compose up -d
   ```
   
   This starts PostgreSQL and Redis. If you don't have Docker, see [SETUP.md](./SETUP.md) for manual installation.

3. **Run database migrations**
   ```bash
   cd packages/backend
   npm run migrate up
   cd ../..
   ```

4. **Start development servers**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Backend API: http://localhost:3000
   - Frontend: http://localhost:5173
   - Health check: http://localhost:3000/health

### Detailed Setup

For detailed setup instructions, troubleshooting, and manual installation without Docker, see [SETUP.md](./SETUP.md).

## Available Scripts

- `npm run dev` - Start all workspaces in development mode
- `npm run build` - Build all workspaces
- `npm run test` - Run tests in all workspaces
- `npm run lint` - Lint all workspaces
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Technology Stack

### Backend
- Node.js with Express
- TypeScript
- PostgreSQL with connection pooling
- Redis for caching
- AWS S3 for document storage
- Winston for logging
- JWT for authentication

### Frontend
- React 18
- TypeScript
- Vite
- React Router
- Axios
- Recharts for data visualization

## Architecture

The platform follows a modular architecture with:
- REST API Gateway with authentication middleware
- Service-oriented backend components
- PostgreSQL for relational data
- Redis for caching and session management
- S3 for document storage
- AI forecasting service for project predictions

## License

Private - All rights reserved
