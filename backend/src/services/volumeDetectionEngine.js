const EventEmitter = require('events');

class VolumeDetectionEngine extends EventEmitter {
  constructor(alpacaService) {
    super();
    this.alpacaService = alpacaService;
    this.watchlist = ['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'SPY'];
    this.volumeData = new Map();
    this.priceData = new Map();
    this.supportResistance = new Map();
    this.isRunning = false;

    // Configuration
    this.config = {
      volumeThreshold: parseFloat(process.env.DEFAULT_VOLUME_THRESHOLD) || 2.5,
      priceChangeThreshold: parseFloat(process.env.DEFAULT_PRICE_CHANGE_THRESHOLD) || 1.5,
      lookbackPeriod: 20, // bars
      minVolume: 100000,
      supportResistanceWindow: 50
    };
  }

  start() {
    if (this.isRunning) {
      console.log('Volume detection engine already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting volume detection engine...');

    // Subscribe to market data for watchlist
    this.alpacaService.subscribeToSymbols(this.watchlist, (data) => {
      this.processMarketData(data);
    });

    // Initialize historical data
    this.initializeHistoricalData();
  }

  stop() {
    this.isRunning = false;
    this.alpacaService.unsubscribeFromSymbols(this.watchlist);
    console.log('Volume detection engine stopped');
  }

  async initializeHistoricalData() {
    console.log('Initializing historical data...');

    for (const symbol of this.watchlist) {
      try {
        const bars = await this.alpacaService.getBars(symbol, {
          timeframe: '1Min',
          limit: this.config.lookbackPeriod * 2
        });

        if (!this.volumeData.has(symbol)) {
          this.volumeData.set(symbol, []);
          this.priceData.set(symbol, []);
        }

        bars.forEach(bar => {
          this.volumeData.get(symbol).push(bar.Volume);
          this.priceData.get(symbol).push({
            high: bar.HighPrice,
            low: bar.LowPrice,
            close: bar.ClosePrice,
            timestamp: bar.Timestamp
          });
        });

        // Calculate initial support and resistance
        this.calculateSupportResistance(symbol);

        console.log(`Initialized ${bars.length} bars for ${symbol}`);
      } catch (error) {
        console.error(`Failed to initialize data for ${symbol}:`, error);
      }
    }
  }

  processMarketData(data) {
    const { type, symbol } = data;

    if (type === 'bar') {
      this.processBar(data);
    } else if (type === 'trade') {
      this.processTrade(data);
    } else if (type === 'quote') {
      this.processQuote(data);
    }
  }

  processBar(bar) {
    const { symbol, volume, high, low, close, timestamp } = bar;

    if (!this.volumeData.has(symbol)) {
      this.volumeData.set(symbol, []);
      this.priceData.set(symbol, []);
    }

    const volumeHistory = this.volumeData.get(symbol);
    const priceHistory = this.priceData.get(symbol);

    // Add new data
    volumeHistory.push(volume);
    priceHistory.push({ high, low, close, timestamp });

    // Keep only lookback period
    if (volumeHistory.length > this.config.lookbackPeriod) {
      volumeHistory.shift();
      priceHistory.shift();
    }

    // Detect abnormal volume
    if (volumeHistory.length >= 10) {
      this.detectAbnormalVolume(symbol, volume, volumeHistory);
    }

    // Update support and resistance periodically
    if (priceHistory.length >= this.config.supportResistanceWindow) {
      this.calculateSupportResistance(symbol);
    }
  }

  processTrade(trade) {
    // Real-time trade processing
    // Can be used for more granular detection
  }

  processQuote(quote) {
    // Process bid/ask spread changes
    const { symbol, bidPrice, askPrice, bidSize, askSize } = quote;

    // Detect large bid/ask imbalances
    const imbalance = bidSize / (askSize || 1);

    if (imbalance > 3 || imbalance < 0.33) {
      this.emit('orderBookImbalance', {
        symbol,
        bidPrice,
        askPrice,
        bidSize,
        askSize,
        imbalance,
        timestamp: new Date()
      });
    }
  }

  detectAbnormalVolume(symbol, currentVolume, volumeHistory) {
    // Calculate average volume
    const avgVolume = volumeHistory.slice(0, -1).reduce((a, b) => a + b, 0) / (volumeHistory.length - 1);

    // Calculate standard deviation
    const variance = volumeHistory.slice(0, -1).reduce((sum, vol) => {
      return sum + Math.pow(vol - avgVolume, 2);
    }, 0) / (volumeHistory.length - 1);

    const stdDev = Math.sqrt(variance);

    // Z-score
    const zScore = (currentVolume - avgVolume) / (stdDev || 1);

    // Check if volume is abnormal
    if (Math.abs(zScore) > this.config.volumeThreshold && currentVolume > this.config.minVolume) {
      const alert = {
        symbol,
        currentVolume,
        avgVolume,
        zScore,
        timestamp: new Date(),
        type: zScore > 0 ? 'spike' : 'drop'
      };

      console.log('Abnormal volume detected:', alert);
      this.emit('volumeAlert', alert);

      // Check if we should trade
      this.evaluateTradeOpportunity(symbol, alert);
    }
  }

  calculateSupportResistance(symbol) {
    const priceHistory = this.priceData.get(symbol);

    if (!priceHistory || priceHistory.length < this.config.supportResistanceWindow) {
      return;
    }

    // Get recent price data
    const recentPrices = priceHistory.slice(-this.config.supportResistanceWindow);

    // Find local maxima (resistance) and minima (support)
    const highs = recentPrices.map(p => p.high);
    const lows = recentPrices.map(p => p.low);

    const resistance = this.findResistanceLevels(highs);
    const support = this.findSupportLevels(lows);

    this.supportResistance.set(symbol, {
      resistance,
      support,
      currentPrice: recentPrices[recentPrices.length - 1].close,
      updatedAt: new Date()
    });
  }

  findResistanceLevels(highs) {
    const sorted = [...highs].sort((a, b) => b - a);
    const levels = [];

    for (let i = 0; i < Math.min(3, sorted.length); i++) {
      const level = sorted[i];
      // Avoid duplicate levels (within 0.5%)
      if (!levels.some(l => Math.abs(l - level) / level < 0.005)) {
        levels.push(level);
      }
    }

    return levels;
  }

  findSupportLevels(lows) {
    const sorted = [...lows].sort((a, b) => a - b);
    const levels = [];

    for (let i = 0; i < Math.min(3, sorted.length); i++) {
      const level = sorted[i];
      // Avoid duplicate levels (within 0.5%)
      if (!levels.some(l => Math.abs(l - level) / level < 0.005)) {
        levels.push(level);
      }
    }

    return levels;
  }

  async evaluateTradeOpportunity(symbol, alert) {
    const srLevels = this.supportResistance.get(symbol);

    if (!srLevels) {
      return;
    }

    const { currentPrice, support, resistance } = srLevels;

    // Simple trading logic
    let shouldTrade = false;
    let side = null;
    let reason = '';

    // Buy signal: Volume spike near support
    if (alert.type === 'spike') {
      const nearSupport = support.some(level =>
        Math.abs(currentPrice - level) / level < 0.01
      );

      if (nearSupport) {
        shouldTrade = true;
        side = 'buy';
        reason = 'Volume spike near support level';
      }
    }

    // Sell signal: Volume spike near resistance
    if (alert.type === 'spike') {
      const nearResistance = resistance.some(level =>
        Math.abs(currentPrice - level) / level < 0.01
      );

      if (nearResistance) {
        const position = await this.alpacaService.getPosition(symbol);
        if (position && position.qty > 0) {
          shouldTrade = true;
          side = 'sell';
          reason = 'Volume spike near resistance level';
        }
      }
    }

    if (shouldTrade) {
      await this.executeTrade(symbol, side, currentPrice, reason);
    }
  }

  async executeTrade(symbol, side, price, reason) {
    try {
      const account = await this.alpacaService.getAccount();
      const buyingPower = parseFloat(account.buying_power);
      const maxPositionSize = parseFloat(process.env.MAX_POSITION_SIZE) || 10000;

      // Calculate quantity
      const positionValue = Math.min(buyingPower * 0.1, maxPositionSize);
      const qty = Math.floor(positionValue / price);

      if (qty <= 0) {
        console.log('Insufficient buying power for trade');
        return;
      }

      const order = await this.alpacaService.placeOrder({
        symbol,
        qty,
        side,
        type: 'market',
        time_in_force: 'day'
      });

      const tradeData = {
        orderId: order.id,
        symbol,
        side,
        qty,
        price,
        reason,
        timestamp: new Date()
      };

      console.log('Trade executed:', tradeData);
      this.emit('tradeExecuted', tradeData);

      return tradeData;
    } catch (error) {
      console.error('Failed to execute trade:', error);
      this.emit('tradeError', { symbol, error: error.message });
    }
  }

  addToWatchlist(symbol) {
    if (!this.watchlist.includes(symbol)) {
      this.watchlist.push(symbol);
      if (this.isRunning) {
        this.alpacaService.subscribeToSymbols([symbol], (data) => {
          this.processMarketData(data);
        });
      }
    }
  }

  removeFromWatchlist(symbol) {
    const index = this.watchlist.indexOf(symbol);
    if (index > -1) {
      this.watchlist.splice(index, 1);
      if (this.isRunning) {
        this.alpacaService.unsubscribeFromSymbols([symbol]);
      }
      this.volumeData.delete(symbol);
      this.priceData.delete(symbol);
      this.supportResistance.delete(symbol);
    }
  }

  getWatchlist() {
    return this.watchlist;
  }

  getSupportResistance(symbol) {
    return this.supportResistance.get(symbol);
  }
}

module.exports = VolumeDetectionEngine;
