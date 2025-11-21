# AI Stock Trader - Real-Time Volume Detection & Paper Trading

A comprehensive paper trading system that detects abnormal buy/sell volumes in real-time and executes automated trades using Alpaca's Paper Trading API and PaperInvest's simulation engine.

## 🚀 Features

### Core Functionality
- **Real-Time Volume Detection**: Statistical analysis to identify abnormal trading volumes
- **Automated Trading**: Execute trades automatically based on detected opportunities
- **Paper Trading**: Risk-free trading with Alpaca's paper trading environment
- **Realistic Simulation**: Slippage and queue simulation via PaperInvest API
- **Support/Resistance Analysis**: Automatic calculation of key price levels
- **Order Book Monitoring**: Track bid/ask imbalances and market depth

### Trading Features
- **Multiple Order Types**: Market, Limit orders
- **Position Management**: Track and manage open positions
- **Real-Time Market Data**: WebSocket integration for live quotes
- **Watchlist Management**: Monitor multiple symbols simultaneously
- **Order History**: Complete trade logging and analysis

### Analytics & Reporting
- **Performance Metrics**: Track P&L, win rate, and other key statistics
- **Performance Charts**: Visualize portfolio performance over time
- **Trade Analysis**: Detailed breakdown of winning/losing trades
- **Simulation Metrics**: Slippage analysis and execution quality

### User Interface
- **Responsive Design**: Mobile-first, works on all devices
- **Real-Time Updates**: WebSocket-powered live data
- **Dark Theme**: Easy on the eyes for extended trading sessions
- **Intuitive Dashboard**: Quick overview of account and market status

## 🛠 Technology Stack

### Backend
- **Node.js + Express**: API server and WebSocket handling
- **Socket.io**: Real-time bidirectional communication
- **Alpaca Trade API**: Market data and order execution
- **PaperInvest API**: Trade execution simulation

### Frontend
- **Next.js 14**: React framework with App Router
- **TailwindCSS**: Utility-first CSS framework
- **Recharts**: Data visualization
- **Socket.io-client**: Real-time updates

### APIs & Services
- **Alpaca Paper Trading API**: Paper trading environment
- **PaperInvest API**: Realistic execution simulation

## 📋 Prerequisites

- Node.js 18+ and npm
- Alpaca Paper Trading Account ([Sign up free](https://alpaca.markets))
- PaperInvest API Key (optional, for enhanced simulation)

## 🔧 Installation

### 1. Clone or Download Repository

```bash
cd ai-stock-trader
```

### 2. Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Alpaca API Configuration
ALPACA_API_KEY=your_alpaca_api_key_here
ALPACA_SECRET_KEY=your_alpaca_secret_key_here
ALPACA_BASE_URL=https://paper-api.alpaca.markets
ALPACA_DATA_URL=https://data.alpaca.markets

# PaperInvest API Configuration (Optional)
PAPERINVEST_API_KEY=your_paperinvest_api_key_here
PAPERINVEST_BASE_URL=https://api.paperinvest.com

# JWT Secret
JWT_SECRET=your_random_secret_key_change_this_in_production

# Trading Configuration
DEFAULT_VOLUME_THRESHOLD=2.5
DEFAULT_PRICE_CHANGE_THRESHOLD=1.5
MAX_POSITION_SIZE=10000
```

### 4. Get Your Alpaca API Keys

1. Go to [Alpaca Markets](https://alpaca.markets)
2. Sign up for a free account
3. Navigate to "Your API Keys" in the dashboard
4. Copy your **Paper Trading** API Key and Secret Key
5. Paste them into your `.env` file

## 🚀 Running the Application

### Development Mode

Start both backend and frontend concurrently:

```bash
npm run dev
```

Or run them separately:

```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### Production Mode

```bash
# Build frontend
npm run build

# Start server
npm start
```

## 📱 Deployment to Replit

### Method 1: Import from GitHub (Recommended)

1. Push your code to GitHub
2. Go to [Replit](https://replit.com)
3. Click "Create Repl" → "Import from GitHub"
4. Select your repository
5. Replit will auto-detect the configuration

### Method 2: Manual Upload

1. Go to [Replit](https://replit.com)
2. Create a new Node.js Repl
3. Upload all files via the file manager
4. Replit will recognize the project structure

### Configure Environment Variables in Replit

1. Click on "Tools" → "Secrets" (or the lock icon)
2. Add each environment variable from your `.env` file:
   - `ALPACA_API_KEY`
   - `ALPACA_SECRET_KEY`
   - `JWT_SECRET`
   - etc.

### Set the Run Command

In `.replit` file or Replit configuration:

```bash
run = "npm run dev"
```

### Important Replit Configuration

Create a `.replit` file in the root directory:

```toml
[run]
command = "npm run dev"

[env]
PORT = "3001"

[deployment]
run = ["sh", "-c", "npm start"]
```

### Access Your Deployed App

Once deployed, Replit will provide a URL like:
```
https://your-repl-name.your-username.repl.co
```

Update your `.env` variables:
```env
FRONTEND_URL=https://your-repl-name.your-username.repl.co
```

## 📖 Usage Guide

### 1. First Time Setup

1. **Create an Account**:
   - Visit the home page
   - Click "Create Account"
   - Fill in your details

2. **Configure Alpaca Keys**:
   - Make sure your Alpaca API keys are set in environment variables
   - The system will connect automatically on startup

### 2. Dashboard Overview

The dashboard shows:
- **Account Summary**: Portfolio value, buying power, returns
- **Volume Alerts**: Real-time abnormal volume detection
- **Market Watch**: Live quotes for watchlist symbols
- **Recent Trades**: Latest executed orders
- **Performance Chart**: Portfolio performance over time

### 3. Adding Symbols to Watchlist

1. Go to the **Watchlist** page
2. Enter a stock symbol (e.g., AAPL, TSLA)
3. Click "Add Symbol"
4. View support/resistance levels for each symbol

### 4. Manual Trading

1. Go to the **Trading** page
2. Fill in the order form:
   - **Symbol**: Stock ticker
   - **Quantity**: Number of shares
   - **Side**: Buy or Sell
   - **Order Type**: Market or Limit
   - **Limit Price**: (if Limit order)
3. Click "Place Order"
4. Monitor order status in "Open Orders" section

### 5. Automated Trading

The system automatically:
- Monitors watchlist symbols for volume spikes
- Calculates support/resistance levels
- Triggers buy signals near support with volume spikes
- Triggers sell signals near resistance with volume spikes
- Executes trades based on configured thresholds

### 6. Viewing Analytics

1. Go to the **Analytics** page
2. View:
   - Total trades and win rate
   - Profit/loss statistics
   - Account status
   - Simulation metrics

## 🔍 Volume Detection Algorithm

### How It Works

1. **Data Collection**: Collects 1-minute bars for each symbol
2. **Statistical Analysis**: Calculates mean and standard deviation of volume
3. **Z-Score Calculation**: Measures how many standard deviations current volume is from mean
4. **Alert Triggering**: Alerts when Z-score exceeds threshold (default: 2.5)
5. **Trade Evaluation**: Checks if volume spike occurs near support/resistance
6. **Order Execution**: Places trade if conditions are met

### Configuration

Adjust in `.env`:
```env
DEFAULT_VOLUME_THRESHOLD=2.5        # Z-score threshold
DEFAULT_PRICE_CHANGE_THRESHOLD=1.5  # Price change percentage
MAX_POSITION_SIZE=10000             # Maximum $ per position
```

## 🛡️ Security Best Practices

1. **Never commit `.env` file**: It's in `.gitignore` by default
2. **Use strong JWT_SECRET**: Generate a random string
3. **Paper trading only**: Never use real trading keys in development
4. **Secure Replit Secrets**: Use Replit's Secrets feature for API keys
5. **HTTPS only**: Replit provides HTTPS by default

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Trading
- `GET /api/trades/orders` - Get orders
- `POST /api/trades/orders` - Place order
- `DELETE /api/trades/orders/:orderId` - Cancel order
- `GET /api/trades/positions` - Get positions
- `GET /api/trades/account` - Get account info

### Market Data
- `GET /api/market/quote/:symbol` - Get quote
- `GET /api/market/bars/:symbol` - Get historical bars
- `POST /api/market/snapshots` - Get multiple snapshots
- `GET /api/market/watchlist` - Get watchlist
- `POST /api/market/watchlist` - Add to watchlist
- `DELETE /api/market/watchlist/:symbol` - Remove from watchlist
- `GET /api/market/levels/:symbol` - Get support/resistance

### Analytics
- `GET /api/analytics/performance` - Performance metrics
- `GET /api/analytics/history` - Trading history
- `GET /api/analytics/statistics` - Win rate and statistics

## 🐛 Troubleshooting

### Alpaca Connection Issues
- Verify API keys are correct
- Check you're using Paper Trading keys (not Live)
- Ensure API endpoint is `https://paper-api.alpaca.markets`

### WebSocket Not Connecting
- Check backend is running on correct port
- Verify `NEXT_PUBLIC_WS_URL` is set correctly
- Check browser console for errors

### Volume Detection Not Working
- Ensure market is open (9:30 AM - 4:00 PM ET)
- Check symbols are valid and tradeable
- Verify Alpaca data feed is active

### Replit Deployment Issues
- Make sure all Secrets are set
- Check the Run command is correct
- View logs in Replit console for errors

## 🎯 Future Enhancements

- [ ] Machine learning for pattern recognition
- [ ] Advanced charting with TradingView
- [ ] Multiple timeframe analysis
- [ ] Backtesting engine
- [ ] Options trading support
- [ ] Crypto trading integration
- [ ] Mobile native apps (React Native)
- [ ] Advanced risk management
- [ ] Portfolio optimization
- [ ] Social trading features

## 📄 License

This project is open source and available for educational purposes.

## ⚠️ Disclaimer

This software is for educational and research purposes only. It uses paper trading (simulated trading) and should not be used with real money without proper testing, risk management, and understanding of financial markets. Trading involves substantial risk of loss. Always do your own research and consult with financial advisors before making investment decisions.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 📧 Support

For questions and support, please open an issue on the repository.

---

**Happy Paper Trading! 📈💰**
