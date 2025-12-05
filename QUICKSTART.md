# 🚀 Quick Start Guide - AI Stock Trader

## Prerequisites
- Node.js 16+ installed
- PostgreSQL installed
- Redis installed (or use Docker)
- Alpaca API keys
- Gemini API key

## Option 1: Run with Docker (Recommended)

### 1. Setup Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your API keys
nano .env
```

### 2. Start All Services
```bash
# Start PostgreSQL, Redis, Backend, and Frontend
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 3. Access Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:4001
- Redis: localhost:6379

---

## Option 2: Run Locally (Development)

### 1. Install Redis
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt update
sudo apt install redis-server
sudo systemctl start redis

# Verify Redis is running
redis-cli ping  # Should return PONG
```

### 2. Install PostgreSQL
```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database
psql postgres
CREATE DATABASE trading_db;
CREATE USER trading_user WITH PASSWORD 'trading_password';
GRANT ALL PRIVILEGES ON DATABASE trading_db TO trading_user;
\q
```

### 3. Setup Backend
```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp ../.env.example .env

# Edit with your keys
nano .env

# Run database migrations
psql -U trading_user -d trading_db -f src/db/schema.sql
psql -U trading_user -d trading_db -f src/db/migrations/001_add_ai_trading_tables.sql
psql -U trading_user -d trading_db -f src/db/migrations/002_add_portfolio_allocation.sql

# Start backend
npm run dev
```

### 4. Setup Frontend
```bash
# In a new terminal
cd frontend

# Install dependencies
npm install

# Start frontend
npm run dev
```

### 5. Access Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:4001

---

## 🔧 Configuration

### Required Environment Variables
Edit `.env` with your actual values:

```env
# Alpaca API (Get from https://alpaca.markets)
ALPACA_API_KEY=your_alpaca_key
ALPACA_SECRET_KEY=your_alpaca_secret

# Gemini AI (Get from https://ai.google.dev)
GEMINI_API_KEY=your_gemini_key

# JWT Secret (Generate with: openssl rand -hex 32)
JWT_SECRET=your_random_secret_here

# Redis (use defaults for local)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=trading_db
POSTGRES_USER=trading_user
POSTGRES_PASSWORD=trading_password
```

---

## ✅ Verify Installation

### 1. Check Redis
```bash
redis-cli ping
# Expected: PONG

redis-cli
> SET test "Hello"
> GET test
> exit
```

### 2. Check PostgreSQL
```bash
psql -U trading_user -d trading_db -c "SELECT NOW();"
# Should show current timestamp
```

### 3. Check Backend
```bash
curl http://localhost:4001/health
# Expected: {"status":"ok","timestamp":"..."}
```

### 4. Check Redis Integration
```bash
# Backend logs should show:
✅ Redis: Connected successfully
✅ Redis: Ready to accept commands
```

### 5. Check Circuit Breakers
```bash
# Backend logs should show:
✅ Gemini AI client initialized with model: gemini-2.0-flash-exp
✅ Circuit breaker CLOSED for GetQuote
✅ Circuit breaker CLOSED for GetBars
```

---

## 🐛 Common Issues

### Redis Not Starting
```bash
# Check if port 6379 is in use
lsof -i :6379

# Kill process if needed
kill -9 <PID>

# Start Redis
redis-server
```

### PostgreSQL Connection Failed
```bash
# Check PostgreSQL is running
pg_isready

# If not running
brew services start postgresql@15  # macOS
sudo systemctl start postgresql    # Linux

# Check connection
psql -U trading_user -d trading_db
```

### Port Already in Use
```bash
# Check what's using port 4001
lsof -i :4001

# Kill process
kill -9 <PID>

# Or change port in .env
BACKEND_PORT=4002
```

### Missing Dependencies
```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

## 🎯 First Time Setup Checklist

- [ ] Redis installed and running
- [ ] PostgreSQL installed and running
- [ ] Database created and migrations run
- [ ] `.env` file created with API keys
- [ ] Backend dependencies installed
- [ ] Frontend dependencies installed
- [ ] Backend running on port 4001
- [ ] Frontend running on port 3000
- [ ] Can access frontend at http://localhost:3000
- [ ] Health check passes at http://localhost:4001/health

---

## 📊 Monitoring

### View Backend Logs
```bash
cd backend
npm run dev

# Look for:
✅ Redis: Connected successfully
✅ Alpaca account connected: ABC123
✅ Market data cache service started
📡 News stream started
```

### Check Rate Limits
```bash
# Get rate limit status
curl http://localhost:4001/api/user/rate-limit-status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Check Redis Cache
```bash
redis-cli
> KEYS market:*
> GET market:quote:AAPL
> KEYS ratelimit:*
```

---

## 🚀 Next Steps

1. **Create Account**: Go to http://localhost:3000 and register
2. **Create Virtual Portfolio**: Portfolio auto-created with $100,000
3. **Create Experiment**: Test different trading strategies
4. **Enable AI Trading**: Create bot with "AI News Trader" strategy
5. **Monitor Performance**: View dashboard for real-time updates

---

## 📚 Documentation

- [Infrastructure Upgrade](INFRASTRUCTURE_UPGRADE.md) - Redis, Circuit Breaker, Rate Limiting
- [API Documentation](http://localhost:4001/api-docs) - Swagger docs (coming soon)
- Backend README: `backend/README.md`
- Frontend README: `frontend/README.md`

---

## 🆘 Getting Help

If you encounter issues:

1. Check logs: `docker-compose logs -f` or terminal output
2. Verify all services running: `docker-compose ps`
3. Check environment variables in `.env`
4. Restart services: `docker-compose restart`
5. Clear cache: `redis-cli FLUSHALL` (dev only)

---

## 🎉 Success!

Your AI Stock Trader is now running with:
- ✅ Redis caching (faster performance)
- ✅ Circuit breaker (failure protection)
- ✅ Rate limiting (API protection)
- ✅ Order validation (safer trading)
- ✅ AI news trading (Gemini powered)
- ✅ Multiple strategies (5 traditional + 1 AI)

Happy Trading! 📈
