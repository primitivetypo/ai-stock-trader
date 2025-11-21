# Trading Bot Experiments

## Overview

The Trading Bot Experiment system allows you to run multiple autonomous trading bots simultaneously, each using different strategies. This lets you compare which trading approach performs best under current market conditions.

## Key Features

- **Autonomous Trading**: Bots make buy/sell decisions independently every 30 seconds
- **Multiple Strategies**: 5 different trading strategies based on proven technical analysis concepts
- **Performance Comparison**: Real-time rankings showing which strategy is most profitable
- **Risk Management**: Each strategy has built-in stop-loss and profit targets
- **Complete Isolation**: Each bot gets its own $100,000 virtual portfolio
- **Real-time Updates**: Live tracking of trades, P&L, and performance metrics

---

## How to Use

### 1. Create an Experiment

1. Navigate to **Trading Experiments** from the dashboard
2. Click **Create New**
3. Select the number of bots (1-10)
4. Choose strategies for each bot (or click "Auto Select")
5. Configure your watchlist (stocks the bots will trade)
6. Click **Create Experiment**

### 2. Start the Experiment

1. Click **Start** on your created experiment
2. All bots begin trading autonomously
3. Each bot analyzes market data every 30 seconds
4. Trades are executed automatically based on strategy conditions

### 3. Monitor Performance

1. Click **View Details** to see real-time performance
2. View the **Performance Comparison** table with rankings
3. See individual bot metrics, trades, and positions
4. Performance updates automatically every 10 seconds

### 4. Stop the Experiment

1. Click **Stop** to end the experiment
2. All bot positions are automatically closed
3. Final results are calculated and saved

---

## Trading Strategies

### 1. Volume Spike Strategy

**Trading Concept**: Abnormal volume often signals institutional activity or major news, typically followed by price movement.

**How It Works**:
- Continuously monitors volume across watchlist
- Calculates Z-score to detect abnormal volume (2+ standard deviations above average)
- Identifies support levels from recent price history
- **Entry**: Buys when volume spike occurs near support level (within 2%)
- **Exit**: Sells at calculated resistance level OR when 3% profit is reached
- **Stop Loss**: 2% below entry price

**Configuration**:
```javascript
{
  volumeThreshold: 2.0,        // Z-score threshold
  supportDistance: 0.02,       // 2% from support
  resistanceTarget: 0.03,      // 3% profit target
  stopLoss: 0.02,              // 2% stop loss
  positionSize: 0.1            // 10% of portfolio per trade
}
```

**Best For**: Volatile markets, news-driven stocks, momentum plays

---

### 2. Momentum Strategy

**Trading Concept**: Stocks in motion tend to stay in motion. Moving average crossovers identify trend changes early.

**How It Works**:
- Calculates two moving averages: Fast (5-period) and Slow (20-period)
- Monitors for crossovers indicating trend direction change
- **Entry**: Buys when fast MA crosses above slow MA (bullish crossover)
- **Exit**: Sells when 5% profit target is reached
- **Stop Loss**: 2.5% below entry price

**Technical Indicators**:
- **Fast MA**: 5-period simple moving average (short-term trend)
- **Slow MA**: 20-period simple moving average (long-term trend)

**Configuration**:
```javascript
{
  fastMA: 5,                   // Fast moving average period
  slowMA: 20,                  // Slow moving average period
  profitTarget: 0.05,          // 5% profit target
  stopLoss: 0.025,             // 2.5% stop loss
  positionSize: 0.15           // 15% of portfolio per trade
}
```

**Best For**: Trending markets, established trends, swing trading

---

### 3. Mean Reversion Strategy

**Trading Concept**: Prices tend to revert to their average after extreme moves. RSI identifies oversold/overbought conditions.

**How It Works**:
- Calculates 14-period Relative Strength Index (RSI)
- Identifies oversold (undervalued) and overbought (overvalued) conditions
- **Entry**: Buys when RSI drops below 30 (oversold)
- **Exit**: Sells when RSI rises above 70 (overbought) OR 3% profit is reached
- **Stop Loss**: 2% below entry price

**Technical Indicators**:
- **RSI**: Measures momentum on a scale of 0-100
  - RSI < 30: Oversold (potential buy)
  - RSI > 70: Overbought (potential sell)
  - RSI 30-70: Neutral

**Configuration**:
```javascript
{
  rsiPeriod: 14,               // RSI calculation period
  oversoldLevel: 30,           // Buy signal threshold
  overboughtLevel: 70,         // Sell signal threshold
  profitTarget: 0.03,          // 3% profit target
  stopLoss: 0.02,              // 2% stop loss
  positionSize: 0.12           // 12% of portfolio per trade
}
```

**Best For**: Range-bound markets, choppy conditions, counter-trend trading

---

### 4. Breakout Strategy

**Trading Concept**: When price breaks through resistance with strong volume, it often continues moving higher.

**How It Works**:
- Calculates resistance levels from recent price history
- Monitors volume for confirmation
- **Entry**: Buys when price breaks 1.5% above resistance AND volume is 1.5x average
- **Exit**: Sells at 6% profit target (larger target for breakout trades)
- **Stop Loss**: 3% below entry price (wider stop for volatility)

**Technical Indicators**:
- **Resistance**: Calculated from local maxima in price history
- **Volume Confirmation**: Current volume must exceed 1.5x average volume

**Configuration**:
```javascript
{
  breakoutThreshold: 0.015,    // 1.5% above resistance
  volumeConfirmation: 1.5,     // 1.5x average volume required
  profitTarget: 0.06,          // 6% profit target
  stopLoss: 0.03,              // 3% stop loss
  positionSize: 0.08           // 8% of portfolio per trade
}
```

**Best For**: Volatile markets, growth stocks, momentum continuation

---

### 5. Support/Resistance Bounce Strategy

**Trading Concept**: Key price levels act as floors (support) and ceilings (resistance) where price tends to bounce.

**How It Works**:
- Identifies support and resistance levels from price history
- Looks for local minima (support) and local maxima (resistance)
- **Entry**: Buys when price touches support level (within 0.5%)
- **Exit**: Sells when price reaches resistance level (within 0.5%)
- **Stop Loss**: 1.5% below support level

**Technical Indicators**:
- **Support**: Average of recent local minimum prices
- **Resistance**: Average of recent local maximum prices

**Configuration**:
```javascript
{
  supportTolerance: 0.005,     // 0.5% tolerance from support
  resistanceTolerance: 0.005,  // 0.5% tolerance from resistance
  profitTarget: 0.04,          // 4% profit target
  stopLoss: 0.015,             // 1.5% stop loss
  positionSize: 0.1            // 10% of portfolio per trade
}
```

**Best For**: Range-bound markets, stable stocks, defined trading ranges

---

## Bot Execution Flow

### Every 30 Seconds, Each Bot:

```
1. UPDATE MARKET DATA
   ├── Fetch latest quotes for watchlist symbols
   ├── Update price history (last 100 bars)
   └── Update volume history (last 100 bars)

2. CHECK EXIT CONDITIONS (For Existing Positions)
   ├── Calculate current profit/loss
   ├── Check if stop-loss triggered
   ├── Check if profit target reached
   ├── Check strategy-specific exit signals
   └── Execute SELL if conditions met

3. CHECK ENTRY CONDITIONS (For New Positions)
   ├── Calculate technical indicators
   ├── Check strategy-specific entry signals
   ├── Verify sufficient cash available
   ├── Calculate position size
   └── Execute BUY if conditions met

4. UPDATE METRICS
   ├── Current equity
   ├── Total profit/loss
   ├── Win/loss count
   └── Trade history
```

---

## Technical Indicator Calculations

### Moving Average (MA)
```javascript
MA = (Price₁ + Price₂ + ... + Priceₙ) / n
```
Example: 5-period MA = (P₁ + P₂ + P₃ + P₄ + P₅) / 5

### Relative Strength Index (RSI)
```javascript
1. Calculate price changes
2. Separate gains and losses
3. Average Gain = Sum of Gains / Period
4. Average Loss = Sum of Losses / Period
5. RS = Average Gain / Average Loss
6. RSI = 100 - (100 / (1 + RS))
```

### Volume Z-Score
```javascript
1. Calculate mean volume: μ = Σ(volumes) / n
2. Calculate standard deviation: σ = √(Σ(volume - μ)² / n)
3. Z-Score = (Current Volume - μ) / σ
```
Z-Score > 2 indicates abnormally high volume (2+ std deviations)

### Support/Resistance Levels
```javascript
Support:
- Find all local minima (prices lower than surrounding prices)
- Average the local minima
- Result: Support level

Resistance:
- Find all local maxima (prices higher than surrounding prices)
- Average the local maxima
- Result: Resistance level
```

---

## Performance Metrics

### For Each Bot:

**Equity Metrics**:
- **Current Equity**: Total portfolio value (cash + positions)
- **Total Profit/Loss**: Change from initial $100,000
- **Return %**: (Current Equity - 100000) / 100000 × 100

**Trading Metrics**:
- **Total Trades**: Number of completed buy/sell pairs
- **Winning Trades**: Trades closed with profit
- **Losing Trades**: Trades closed with loss
- **Win Rate %**: (Winning Trades / Total Trades) × 100

**Position Metrics**:
- **Current Positions**: Open stock positions
- **Available Cash**: Buying power remaining
- **Position Size**: Value of each position

---

## Experiment Results

### Performance Comparison Table

Experiments generate a ranked leaderboard showing:

| Rank | Strategy | Final Equity | Profit/Loss | Return % | Trades | Win Rate |
|------|----------|--------------|-------------|----------|--------|----------|
| 1st  | Strategy A | $103,500 | +$3,500 | +3.50% | 12 | 75% (9W/3L) |
| 2nd  | Strategy B | $102,100 | +$2,100 | +2.10% | 8 | 62.5% (5W/3L) |
| 3rd  | Strategy C | $100,500 | +$500 | +0.50% | 15 | 53.3% (8W/7L) |
| 4th  | Strategy D | $99,800 | -$200 | -0.20% | 6 | 50% (3W/3L) |
| 5th  | Strategy E | $98,500 | -$1,500 | -1.50% | 10 | 40% (4W/6L) |

**Key Insights**:
- Shows which strategy performs best in current market conditions
- Win rate doesn't always correlate with profitability
- More trades doesn't guarantee better performance
- Each experiment provides data to refine future strategies

---

## Architecture

### Data Flow

```
User Creates Experiment
    ↓
TradingBotService.createExperiment()
    ↓
Creates N Bots with Selected Strategies
    ↓
Each Bot Gets Virtual Portfolio ($100k)
    ↓
User Starts Experiment
    ↓
TradingBotService.startExperiment()
    ↓
Each Bot Starts 30-Second Loop
    ↓
┌─────────────────────────────────┐
│  Bot Trading Loop (Every 30s)   │
├─────────────────────────────────┤
│ 1. Fetch Market Data (Alpaca)  │
│ 2. Update Price/Volume History │
│ 3. Check Exit Conditions        │
│    └─> Sell if triggered        │
│ 4. Check Entry Conditions       │
│    └─> Buy if triggered         │
│ 5. Update Metrics               │
│ 6. Emit Trade Events            │
└─────────────────────────────────┘
    ↓
VirtualPortfolioService
    ↓
Simulated Order Execution
    ↓
Real Market Prices (Alpaca)
    ↓
Frontend Updates (WebSocket)
```

### File Structure

```
backend/
├── src/
│   ├── services/
│   │   ├── tradingBotService.js      # Main bot orchestration
│   │   ├── virtualPortfolioService.js # Simulated trading
│   │   └── alpacaService.js           # Market data
│   └── api/
│       └── experiments.js             # REST API endpoints

frontend/
├── src/
│   ├── components/
│   │   └── experiments/
│   │       ├── ExperimentCreate.js    # Create new experiment
│   │       ├── ExperimentList.js      # View all experiments
│   │       └── ExperimentDetails.js   # Performance comparison
│   └── app/
│       └── experiments/
│           └── page.js                # Main experiments page
```

---

## API Endpoints

### Create Experiment
```http
POST /api/experiments/create
Authorization: Bearer {token}

Body:
{
  "botCount": 5,
  "strategies": ["volume-spike", "momentum", "mean-reversion", "breakout", "support-resistance"],
  "watchlist": ["AAPL", "TSLA", "NVDA", "MSFT", "GOOGL"],
  "duration": null
}

Response:
{
  "id": "exp-1234567890",
  "userId": "user-123",
  "botCount": 5,
  "status": "created",
  "bots": ["exp-1234567890-bot-1", "exp-1234567890-bot-2", ...]
}
```

### Start Experiment
```http
POST /api/experiments/{experimentId}/start
Authorization: Bearer {token}

Response:
{
  "id": "exp-1234567890",
  "status": "running",
  "startTime": "2024-01-15T10:30:00Z"
}
```

### Stop Experiment
```http
POST /api/experiments/{experimentId}/stop
Authorization: Bearer {token}

Response:
{
  "id": "exp-1234567890",
  "status": "stopped",
  "endTime": "2024-01-15T16:30:00Z",
  "results": [...]
}
```

### Get Experiment Results
```http
GET /api/experiments/{experimentId}/results
Authorization: Bearer {token}

Response:
{
  "experimentId": "exp-1234567890",
  "status": "stopped",
  "results": [
    {
      "botId": "exp-1234567890-bot-1",
      "strategy": "Volume Spike Strategy",
      "finalEquity": 103500,
      "totalProfit": 3500,
      "returnPercent": 3.5,
      "totalTrades": 12,
      "winningTrades": 9,
      "losingTrades": 3,
      "winRate": 75
    },
    ...
  ]
}
```

---

## Best Practices

### When Creating Experiments

1. **Choose Complementary Strategies**: Select strategies that work in different market conditions
   - Include both trend-following (momentum, breakout) and counter-trend (mean reversion)
   - Mix aggressive (breakout) and conservative (support/resistance) approaches

2. **Watchlist Selection**:
   - Use liquid stocks with good volume (e.g., AAPL, TSLA, NVDA)
   - Include different sectors for diversification
   - Avoid low-volume penny stocks (insufficient data)

3. **Timing**:
   - Run during market hours (9:30 AM - 4:00 PM ET) for best results
   - Avoid first 15 minutes (high volatility)
   - Market closed? Bots still analyze, but won't find entry opportunities

### Interpreting Results

1. **Don't Judge by Single Trades**: Look at overall performance across many trades
2. **Consider Market Conditions**:
   - Trending market: Momentum/Breakout strategies perform better
   - Choppy market: Mean Reversion/Support-Resistance perform better
3. **Win Rate ≠ Profitability**: A strategy with 40% win rate but large wins can outperform 70% win rate with small wins
4. **Sample Size Matters**: More trades = more reliable performance data

---

## Limitations

### Current Limitations

1. **Paper Trading Only**: All trades are simulated, no real money
2. **Market Data**: Limited to stocks supported by Alpaca API
3. **Execution**: Assumes instant fills at market price (no slippage)
4. **Data Frequency**: 30-second decision loop (not tick-by-tick)
5. **No Pre-Market/After-Hours**: Trading only during regular market hours
6. **Memory Storage**: Experiment data lost on server restart (not persisted to database)

### Future Enhancements

- [ ] Database persistence for experiment history
- [ ] Backtesting against historical data
- [ ] Custom strategy builder
- [ ] Risk management (max drawdown limits)
- [ ] Position sizing options (fixed, percentage, volatility-based)
- [ ] Multi-timeframe analysis
- [ ] Machine learning strategy adaptation
- [ ] Email/SMS alerts for major events

---

## Troubleshooting

### Bots Not Trading

**Problem**: Experiment is running but bots make no trades

**Possible Causes**:
1. **Market Closed**: Bots need real-time data to trade
   - Solution: Run during market hours (9:30 AM - 4:00 PM ET)

2. **No Entry Signals**: Current market conditions don't meet strategy criteria
   - Solution: Wait longer or try different watchlist symbols

3. **Insufficient Cash**: Bot ran out of money for new positions
   - Solution: Stop experiment and restart (resets to $100k)

### Slow Performance

**Problem**: Dashboard updates slowly or bots lag

**Possible Causes**:
1. **Too Many Bots**: Running 10+ bots simultaneously
   - Solution: Reduce to 5 bots per experiment

2. **Large Watchlist**: 20+ symbols per bot
   - Solution: Limit to 5-10 liquid symbols

### Unexpected Losses

**Problem**: All bots are losing money

**Possible Causes**:
1. **Market Volatility**: Extreme market conditions trigger stop-losses
   - Solution: Normal in volatile markets, continue monitoring

2. **Stop-Loss Too Tight**: Getting stopped out before moves develop
   - Solution: Strategies have predefined stops, but this is useful feedback

---

## Summary

The Trading Bot Experiment system provides a safe, simulated environment to test different trading strategies simultaneously. By comparing performance across multiple approaches, you can identify which strategies work best in different market conditions.

**Key Takeaways**:
- Each bot trades independently with $100,000 virtual allocation
- 5 strategies based on proven technical analysis concepts
- Autonomous decision-making every 30 seconds
- Real-time performance tracking and comparison
- Complete risk management with stop-losses and profit targets
- No real money at risk - perfect for learning and experimentation

Start your first experiment today and discover which trading strategy works best for you!
