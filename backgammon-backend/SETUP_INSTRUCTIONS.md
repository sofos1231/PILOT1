# Backgammon Backend Setup Instructions

## Prerequisites

### 1. Install PostgreSQL
- Download PostgreSQL from https://www.postgresql.org/download/windows/
- Install version 12 or higher
- During installation, remember the password you set for the `postgres` user
- Make sure PostgreSQL service is running

### 2. Add PostgreSQL to PATH (Windows)
After installation, add PostgreSQL bin directory to your system PATH:
1. Search for "Environment Variables" in Windows search
2. Edit "System Environment Variables"
3. Add to PATH: `C:\Program Files\PostgreSQL\<version>\bin`
4. Restart your terminal/IDE

## Database Setup

### 1. Create Database
Open a terminal and run:
```bash
# Login to PostgreSQL (will prompt for password)
psql -U postgres

# In psql prompt, create database:
CREATE DATABASE backgammon_club_dev;

# Exit psql
\q
```

### 2. Load Schema
```bash
cd backgammon-backend
psql -U postgres -d backgammon_club_dev -f database_schema.sql
```

### 3. Update .env file (if needed)
If you used a different password during PostgreSQL installation, update the DATABASE_URL in `.env`:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/backgammon_club_dev
```

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

## Testing Endpoints

### Health Check
```bash
curl http://localhost:8000/v1/health
```

### Register User
```bash
curl -X POST http://localhost:8000/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123",
    "country": "USA",
    "age_confirmed": true
  }'
```

### Login
```bash
curl -X POST http://localhost:8000/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Get Profile (replace TOKEN with access_token from login)
```bash
curl http://localhost:8000/v1/auth/profile \
  -H 'Authorization: Bearer TOKEN'
```

## Troubleshooting

### PostgreSQL Connection Error
If you see `ECONNREFUSED 127.0.0.1:5432`:
1. Verify PostgreSQL service is running
2. Check that PostgreSQL is listening on port 5432
3. Verify DATABASE_URL in .env is correct

### TypeScript Compilation Errors
If you encounter TypeScript errors:
1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. Try `npm run build` to check for errors

## Current Status

✅ All files created
✅ All dependencies installed
✅ Code compiles successfully
⚠️  PostgreSQL needs to be installed and configured
⚠️  Database schema needs to be loaded

Once PostgreSQL is set up, the server will start successfully on port 8000.
