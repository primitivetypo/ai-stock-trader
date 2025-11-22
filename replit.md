# AI Stock Trader - Replit Project

## Project Overview
Real-time abnormal volume detection with paper trading application. This system monitors stock market data, detects unusual trading patterns, and executes automated trades using Alpaca's Paper Trading API.

## Technology Stack
- **Frontend**: Next.js 14 (React framework)
- **Backend**: Express.js + Socket.IO
- **Database**: PostgreSQL (Neon)
- **APIs**: Alpaca Paper Trading API
- **Real-time**: WebSocket connections for live market data

## Project Structure
```
├── backend/
│   ├── server.js              # Express server & WebSocket setup
│   ├── src/
│   │   ├── api/               # API route handlers
│   │   ├── services/          # Business logic (Alpaca, volume detection, trading bot)
│   │   └── db/                # Database configuration and schema
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   ├── components/        # React components
│   │   └── lib/               # Utility functions and API client
├── package.json               # Root dependencies and scripts
└── frontend/package.json      # Frontend dependencies
```

## Architecture

### Backend (Port 4001 - localhost)
- Express server with REST API endpoints
- Socket.IO for real-time market data streaming
- Alpaca API integration for market data and paper trading
- Volume detection engine for abnormal trading patterns
- Virtual portfolio service for managing simulated trades
- PostgreSQL database for user data, portfolios, and orders

### Frontend (Port 5000 - 0.0.0.0)
- Next.js 14 with App Router
- Real-time WebSocket connection to backend
- Responsive dashboard with trading interface
- Charts and analytics powered by Recharts

## Environment Variables

### Required Secrets (already configured)
- `ALPACA_API_KEY` - Alpaca Paper Trading API key
- `ALPACA_SECRET_KEY` - Alpaca Paper Trading Secret key  
- `JWT_SECRET` - Secret for JWT authentication
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)

### Public Environment Variables
- `NODE_ENV=development`
- `PORT=4001` (backend port)
- `NEXT_PUBLIC_API_URL=http://localhost:4001`
- `NEXT_PUBLIC_WS_URL=http://localhost:4001`
- `ALPACA_BASE_URL=https://paper-api.alpaca.markets`
- `ALPACA_DATA_URL=https://data.alpaca.markets`
- `DEFAULT_VOLUME_THRESHOLD=2.5`
- `DEFAULT_PRICE_CHANGE_THRESHOLD=1.5`
- `MAX_POSITION_SIZE=10000`

## Database Schema
The PostgreSQL database contains these tables:
- **users** - User authentication
- **portfolios** - Virtual portfolio balances
- **positions** - Open stock positions
- **orders** - Order history (open, filled, cancelled)
- **experiments** - Trading bot experiments
- **bots** - Individual trading bots
- **bot_metrics** - Bot performance metrics
- **bot_trades** - Bot trade history
- **price_history** - Historical price data for analysis

To reinitialize the database:
```bash
node backend/src/db/init.js
```

## Running the Application

The application runs automatically via the configured workflow "Start application" which executes:
```bash
npm run dev
```

This starts both backend and frontend concurrently:
- Backend: `nodemon backend/server.js` on localhost:4001
- Frontend: `next dev -p 5000 -H 0.0.0.0`

## Demo Credentials
- Email: demo@demo.com
- Password: demo123

## Features

### Core Trading Features
- Real-time market data streaming
- Abnormal volume detection algorithm
- Automated trade execution
- Paper trading with Alpaca API
- Support/resistance level calculation
- Order book monitoring

### User Interface
- Dashboard with account summary
- Live volume alerts
- Trading interface for manual orders
- Watchlist management
- Analytics and performance tracking
- Experiment creation for trading bot strategies

### Trading Bot System
- Multiple strategy support
- Backtesting and live simulation
- Performance metrics tracking
- Configurable parameters per strategy

## Development Notes

### Key Services

1. **AlpacaService** (`backend/src/services/alpacaService.js`)
   - Connects to Alpaca Paper Trading API
   - Fetches market data, quotes, and historical bars
   - Executes orders

2. **VolumeDetectionEngine** (`backend/src/services/volumeDetectionEngine.js`)
   - Monitors watchlist symbols for abnormal volume
   - Calculates statistical thresholds (Z-score)
   - Triggers alerts and automated trades

3. **VirtualPortfolioService** (`backend/src/services/virtualPortfolioService.js`)
   - Manages virtual portfolios and positions
   - Processes order execution
   - Tracks P&L and portfolio metrics

4. **TradingBotService** (`backend/src/services/tradingBotService.js`)
   - Manages trading experiments
   - Runs multiple bot instances
   - Tracks performance metrics

### Database Connection
The backend uses pg-pool for PostgreSQL connections. SSL is automatically enabled when the DATABASE_URL contains `sslmode=require`.

### WebSocket Communication
Socket.IO handles real-time updates between backend and frontend:
- Market data streaming
- Volume alerts
- Trade execution notifications
- Bot status updates

## Deployment
The project is configured for Replit's autoscale deployment:
- Build: `npm run build` (compiles Next.js frontend)
- Run: `npm run dev` (runs both backend and frontend)

## Troubleshooting

### Database Connection Issues
If you see "relation does not exist" errors:
1. Verify DATABASE_URL is set correctly
2. Run `node backend/src/db/init.js` to initialize schema
3. Restart the workflow

### Market Data Not Loading
- Ensure Alpaca API keys are valid
- Check that market hours are active (9:30 AM - 4:00 PM ET)
- Verify ALPACA_BASE_URL points to paper-api.alpaca.markets

### Frontend Not Loading
- Ensure Next.js is running on port 5000
- Check browser console for errors
- Verify NEXT_PUBLIC_API_URL matches backend URL

## Recent Changes (Project Import Setup)
- Configured Next.js to run on port 5000 with 0.0.0.0 binding for Replit proxy
- Updated database.js to handle SSL connections properly
- Added error handling for database connection timing issues
- Fixed demo user creation with delayed initialization
- Configured deployment settings for Replit autoscale

## Resources
- [Alpaca API Documentation](https://alpaca.markets/docs/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Socket.IO Documentation](https://socket.io/docs/)
