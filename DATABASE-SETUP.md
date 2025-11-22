# PostgreSQL Database Setup Guide

## Overview

This guide will help you migrate from in-memory storage to PostgreSQL for persistent data storage.

## Prerequisites

### Install PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows:**
Download and install from: https://www.postgresql.org/download/windows/

## Database Setup

### 1. Create Database

```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE ai_stock_trader;

# Create user (optional, for production)
CREATE USER trader_app WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE ai_stock_trader TO trader_app;

# Exit psql
\q
```

### 2. Initialize Schema

```bash
# Run initialization script
cd backend
node src/db/init.js
```

This creates all necessary tables:
- users
- portfolios
- positions
- orders
- experiments
- bots
- bot_metrics
- bot_trades
- price_history

### 3. Update Environment Variables

Add to your `.env` file:

```env
# Database Configuration
DATABASE_URL=postgresql://localhost:5432/ai_stock_trader

# For production with authentication:
# DATABASE_URL=postgresql://trader_app:your_secure_password@localhost:5432/ai_stock_trader
```

## Database Schema

### Users Table
Stores user authentication data
- Replaces in-memory `Map` in auth.js

### Portfolios Table  
Stores virtual portfolio balances
- Replaces `portfolios` Map in virtualPortfolioService.js

### Positions Table
Stores open positions per user
- Replaces `positions` Map in virtualPortfolioService.js

### Orders Table
Stores all orders (open, filled, cancelled)
- Replaces `orders` array in virtualPortfolioService.js

### Experiments Table
Stores experiment configurations
- Replaces `experiments` Map in tradingBotService.js

### Bots Table
Stores bot instances and configurations
- Replaces `bots` Map in tradingBotService.js

### Bot Metrics Table
Stores bot performance metrics
- Part of bot state in tradingBotService.js

### Bot Trades Table
Stores all bot trades
- Part of bot state in tradingBotService.js

### Price History Table
Stores price/volume history for bot analysis
- Part of bot state in tradingBotService.js

## Migration Impact

### What Changes:
✅ **Data persists** across server restarts
✅ **Experiments survive** crashes
✅ **Trade history preserved**
✅ **User portfolios saved**

### What Stays the Same:
✅ All API endpoints work identically
✅ Frontend unchanged
✅ User experience unchanged

## Testing

### Verify Database Connection

```bash
# From project root
node -e "const pool = require('./backend/src/db/database'); pool.query('SELECT NOW()', (err, res) => { console.log(err ? err : res.rows[0]); pool.end(); })"
```

### Check Tables

```bash
psql ai_stock_trader

# List tables
\dt

# Check users
SELECT * FROM users;

# Check experiments
SELECT * FROM experiments;

# Exit
\q
```

## Development vs Production

### Development (Local)
```env
DATABASE_URL=postgresql://localhost:5432/ai_stock_trader
```

### Production (Heroku, Railway, etc.)
Database URL provided automatically by hosting platform

Example:
```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname?ssl=true
```

## Backup & Restore

### Backup Database

```bash
pg_dump ai_stock_trader > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
psql ai_stock_trader < backup_20240115.sql
```

## Troubleshooting

### Connection Error

**Error:** `ECONNREFUSED ::1:5432`

**Fix:** PostgreSQL not running
```bash
# macOS
brew services start postgresql@14

# Linux
sudo systemctl start postgresql
```

### Permission Denied

**Error:** `permission denied for database`

**Fix:** Grant proper permissions
```bash
psql postgres
GRANT ALL PRIVILEGES ON DATABASE ai_stock_trader TO your_user;
```

### Port Already in Use

**Error:** `port 5432 is already in use`

**Fix:** Another PostgreSQL instance running
```bash
# Find process
lsof -i :5432

# Kill if needed
kill -9 <PID>
```

## Next Steps

After database setup:

1. ✅ Database installed and running
2. ✅ Schema initialized
3. ⏳ Update backend services (next step)
4. ⏳ Test with experiments
5. ⏳ Verify data persistence

## Notes

- Database runs on port 5432 by default
- Demo user will be auto-created with hashed password
- All existing in-memory data will be lost (one-time migration)
- Server restart required after setup

---

**Ready to proceed with implementation?**

The database is ready. Next, we need to update the backend services to use PostgreSQL instead of in-memory Maps.
