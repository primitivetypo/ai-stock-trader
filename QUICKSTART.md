# Quick Start Guide

Get your AI Stock Trader up and running in 5 minutes!

## 🚀 Fastest Path to Running

### 1. Get Alpaca API Keys (2 minutes)

1. Go to https://alpaca.markets
2. Sign up (free, no credit card needed)
3. Navigate to "Paper Trading" → "Your API Keys"
4. Copy your API Key and Secret Key

### 2. Setup Project (1 minute)

```bash
# Install all dependencies
npm run install:all
```

### 3. Configure Environment (1 minute)

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and add your Alpaca keys:

```env
ALPACA_API_KEY=your_key_here
ALPACA_SECRET_KEY=your_secret_here
JWT_SECRET=any_random_string_here
```

### 4. Run Application (1 minute)

```bash
npm run dev
```

Visit: http://localhost:3000

## ✅ First Steps

### 1. Create Account
- Click "Create Account" on home page
- Enter email and password
- Click "Create Account"

### 2. Explore Dashboard
- View your $100,000 paper trading account
- See real-time market data
- Monitor volume alerts

### 3. Add Symbols to Watch
- Go to "Watchlist" page
- Add symbols like: AAPL, TSLA, MSFT, GOOGL
- View support/resistance levels

### 4. Place Your First Trade
- Go to "Trading" page
- Enter symbol (e.g., AAPL)
- Set quantity (e.g., 10)
- Select "Buy" and "Market"
- Click "Place Buy Order"

### 5. Monitor Performance
- Go to "Analytics" page
- View win rate and P&L
- Track trading statistics

## 📱 Deploy to Replit (5 minutes)

### Quick Deploy

1. Go to https://replit.com
2. Click "+ Create Repl"
3. Choose "Import from GitHub" or upload files
4. Click "Secrets" and add:
   - `ALPACA_API_KEY`
   - `ALPACA_SECRET_KEY`
   - `JWT_SECRET`
5. Click "Run"

Done! Your app is live on the web.

## 🎯 Key Features to Try

### Automated Trading
- Add symbols to watchlist
- System monitors for volume spikes
- Auto-trades near support/resistance
- View trades in dashboard

### Manual Trading
- Trading page → Place orders
- Market or Limit orders
- Track positions in real-time
- Cancel open orders

### Performance Tracking
- Analytics page → View statistics
- Win rate and P&L
- Trading history
- Performance charts

## 🔍 Understanding Volume Detection

The system detects abnormal volume by:

1. **Collecting Data**: Monitors 1-minute bars
2. **Statistical Analysis**: Calculates average volume
3. **Z-Score**: Measures deviation from normal
4. **Alert**: Triggers when Z-score > 2.5
5. **Trade**: Executes if near support/resistance

## 💡 Pro Tips

### 1. Start Small
- Begin with 1-2 symbols
- Use small position sizes
- Monitor closely for first few days

### 2. Customize Settings
In `.env`, adjust:
```env
DEFAULT_VOLUME_THRESHOLD=2.5      # Higher = fewer alerts
MAX_POSITION_SIZE=10000           # Lower = less risk
```

### 3. Best Symbols
Good for testing:
- **High Volume**: SPY, QQQ, AAPL
- **Volatile**: TSLA, NVDA, META
- **Stable**: MSFT, GOOGL, AMZN

### 4. Market Hours
- Trading: 9:30 AM - 4:00 PM ET (Mon-Fri)
- Pre-market: 4:00 AM - 9:30 AM ET
- After-hours: 4:00 PM - 8:00 PM ET

### 5. Paper Trading Tips
- Treat it like real money
- Test strategies thoroughly
- Track what works and what doesn't
- Review trades daily

## 🐛 Quick Troubleshooting

### "Cannot connect to Alpaca"
- Check API keys are correct
- Verify you're using **Paper Trading** keys
- Ensure no extra spaces in `.env`

### "No market data"
- Check if market is open
- Verify symbols are valid
- Restart the application

### "WebSocket not connecting"
- Check backend is running on port 3001
- Verify frontend is on port 3000
- Check browser console for errors

### "Orders not executing"
- Ensure market is open
- Check you have buying power
- Verify symbol is tradeable

## 📚 Next Steps

1. **Read Full Docs**: See `README.md` for details
2. **Deploy to Production**: See `DEPLOYMENT.md`
3. **Customize**: Modify detection algorithms
4. **Add Features**: Extend with new functionality

## 🎓 Learning Resources

### Alpaca Documentation
- https://alpaca.markets/docs

### Trading Concepts
- Volume analysis
- Support and resistance
- Technical indicators
- Risk management

### Next.js & React
- https://nextjs.org/docs
- https://react.dev

## ⚠️ Important Reminders

- ✅ This is **paper trading** (fake money)
- ✅ Perfect for learning and testing
- ❌ Never use real trading keys in development
- ❌ Don't risk real money without thorough testing

## 🎉 You're Ready!

Start exploring, test strategies, and have fun learning algorithmic trading!

Questions? Check the full README.md or open an issue.

**Happy Trading! 📈**
