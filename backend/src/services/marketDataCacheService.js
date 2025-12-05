const EventEmitter = require('events');

/**
 * Market Data Cache Service
 * Centralizes market data fetching to avoid duplicate API calls across bots
 * Caches quotes, bars, and calculated technical indicators
 */
class MarketDataCacheService extends EventEmitter {
  constructor(alpacaService) {
    super();
    this.alpacaService = alpacaService;
    this.cache = new Map(); // symbol -> { quote, bars, indicators, lastUpdate }
    this.symbols = new Set(); // Tracked symbols
    this.updateInterval = null;
    this.refreshIntervalMs = 30000; // 30 seconds
  }

  /**
   * Start the cache service
   */
  start() {
    console.log('📊 Starting market data cache service...');

    // Initial update
    this.updateAllSymbols();

    // Set up periodic updates
    this.updateInterval = setInterval(() => {
      this.updateAllSymbols();
    }, this.refreshIntervalMs);

    console.log(`✅ Market data cache service started (refresh: ${this.refreshIntervalMs / 1000}s)`);
  }

  /**
   * Stop the cache service
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    console.log('🛑 Market data cache service stopped');
  }

  /**
   * Add symbols to track
   */
  async addSymbols(symbols) {
    const newSymbols = [];
    for (const symbol of symbols) {
      if (!this.symbols.has(symbol)) {
        this.symbols.add(symbol);
        newSymbols.push(symbol);
      }
    }

    if (newSymbols.length > 0) {
      console.log(`📊 Added ${newSymbols.length} new symbols to cache:`, newSymbols);
      // Immediately fetch data for new symbols (wait for completion)
      await this.updateSymbols(newSymbols);
      console.log(`✅ Initial cache population complete for ${newSymbols.length} symbols`);
    }
  }

  /**
   * Remove symbols from tracking
   */
  removeSymbols(symbols) {
    for (const symbol of symbols) {
      this.symbols.delete(symbol);
      this.cache.delete(symbol);
    }
    console.log(`📊 Removed ${symbols.length} symbols from cache`);
  }

  /**
   * Update all tracked symbols
   */
  async updateAllSymbols() {
    if (this.symbols.size === 0) return;

    const symbolArray = Array.from(this.symbols);
    await this.updateSymbols(symbolArray);
  }

  /**
   * Update specific symbols
   */
  async updateSymbols(symbols) {
    const updatePromises = symbols.map(symbol => this.updateSymbol(symbol));
    await Promise.allSettled(updatePromises);
  }

  /**
   * Update a single symbol
   */
  async updateSymbol(symbol) {
    try {
      console.log(`📊 Updating cache for ${symbol}...`);

      // Fetch quote and bars in parallel
      const [quote, bars] = await Promise.all([
        this.alpacaService.getQuote(symbol),
        this.alpacaService.getBars(symbol, '1Min', 100)
      ]);

      console.log(`   ${symbol}: Got quote (${quote ? 'yes' : 'no'}) and ${bars ? bars.length : 0} bars`);

      // Calculate technical indicators
      const indicators = this.calculateIndicators(bars);

      // Store in cache
      this.cache.set(symbol, {
        symbol,
        quote,
        bars,
        indicators,
        lastUpdate: new Date()
      });

      console.log(`✅ Cached data for ${symbol}`);

      // Emit event for listeners
      this.emit('dataUpdated', { symbol, quote, bars, indicators });

    } catch (error) {
      console.error(`❌ Failed to update cache for ${symbol}:`, error.message);
    }
  }

  /**
   * Get cached data for a symbol
   */
  getCachedData(symbol) {
    return this.cache.get(symbol) || null;
  }

  /**
   * Get quote from cache
   */
  getQuote(symbol) {
    const cached = this.cache.get(symbol);
    return cached ? cached.quote : null;
  }

  /**
   * Get bars from cache
   */
  getBars(symbol) {
    const cached = this.cache.get(symbol);
    return cached ? cached.bars : null;
  }

  /**
   * Get indicators from cache
   */
  getIndicators(symbol) {
    const cached = this.cache.get(symbol);
    return cached ? cached.indicators : null;
  }

  /**
   * Check if symbol is in cache and fresh
   */
  isFresh(symbol, maxAgeMs = 60000) {
    const cached = this.cache.get(symbol);
    if (!cached) return false;

    const age = Date.now() - cached.lastUpdate.getTime();
    return age < maxAgeMs;
  }

  /**
   * Calculate technical indicators from bars
   */
  calculateIndicators(bars) {
    if (!bars || bars.length === 0) {
      return {
        sma20: null,
        sma50: null,
        rsi: null,
        prices: [],
        volumes: []
      };
    }

    const prices = bars.map(bar => bar.c);
    const volumes = bars.map(bar => bar.v);

    return {
      sma20: this.calculateSMA(prices, 20),
      sma50: this.calculateSMA(prices, 50),
      rsi: this.calculateRSI(prices, 14),
      prices,
      volumes,
      latestPrice: prices[prices.length - 1],
      latestVolume: volumes[volumes.length - 1]
    };
  }

  /**
   * Calculate Simple Moving Average
   */
  calculateSMA(prices, period) {
    if (prices.length < period) return null;

    const recentPrices = prices.slice(-period);
    const sum = recentPrices.reduce((a, b) => a + b, 0);
    return sum / period;
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    // Calculate initial average gain and loss
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Calculate subsequent values using smoothing
    for (let i = period + 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        avgGain = (avgGain * (period - 1) + change) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
      }
    }

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      trackedSymbols: this.symbols.size,
      cachedSymbols: this.cache.size,
      symbols: Array.from(this.symbols),
      refreshInterval: this.refreshIntervalMs / 1000
    };
  }
}

// Singleton instance
let marketDataCacheInstance = null;

function getMarketDataCacheService(alpacaService) {
  if (!marketDataCacheInstance && alpacaService) {
    marketDataCacheInstance = new MarketDataCacheService(alpacaService);
  }
  return marketDataCacheInstance;
}

module.exports = { MarketDataCacheService, getMarketDataCacheService };
