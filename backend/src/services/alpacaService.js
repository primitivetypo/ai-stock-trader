const Alpaca = require('@alpacahq/alpaca-trade-api');
const EventEmitter = require('events');
const axios = require('axios');
const CircuitBreaker = require('opossum');
const { getRedisService } = require('./redisService');

class AlpacaService extends EventEmitter {
  constructor() {
    super();
    this.alpaca = new Alpaca({
      keyId: process.env.ALPACA_API_KEY,
      secretKey: process.env.ALPACA_SECRET_KEY,
      paper: true,
      usePolygon: false
    });

    this.dataStream = null;
    this.subscribedSymbols = new Set();
    this.redis = getRedisService();

    // Initialize circuit breakers for Alpaca API calls
    this.initializeCircuitBreakers();
  }

  /**
   * Initialize circuit breakers for critical API calls
   */
  initializeCircuitBreakers() {
    const breakerOptions = {
      timeout: 5000,              // 5 second timeout
      errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
      resetTimeout: 30000,        // Try again after 30 seconds
      rollingCountTimeout: 60000, // 1 minute rolling window
      rollingCountBuckets: 10,    // Number of buckets in rolling window
      name: 'AlpacaAPI'
    };

    // Circuit breaker for getQuote
    this.getQuoteBreaker = new CircuitBreaker(
      async (symbol) => {
        // Check rate limit before making request
        const canProceed = await this.redis.checkAlpacaRateLimit();
        if (!canProceed) {
          throw new Error('Alpaca API rate limit exceeded');
        }
        return await this.alpaca.getLatestQuote(symbol);
      },
      { ...breakerOptions, name: 'GetQuote' }
    );

    // Circuit breaker for getBars
    this.getBarsBreaker = new CircuitBreaker(
      async (symbol, options) => {
        const canProceed = await this.redis.checkAlpacaRateLimit();
        if (!canProceed) {
          throw new Error('Alpaca API rate limit exceeded');
        }
        const bars = await this.alpaca.getBarsV2(symbol, options);
        const barArray = [];
        for await (let bar of bars) {
          barArray.push(bar);
        }
        return barArray;
      },
      { ...breakerOptions, name: 'GetBars' }
    );

    // Circuit breaker for getAccount
    this.getAccountBreaker = new CircuitBreaker(
      async () => await this.alpaca.getAccount(),
      { ...breakerOptions, name: 'GetAccount' }
    );

    // Circuit breaker for placeOrder
    this.placeOrderBreaker = new CircuitBreaker(
      async (params) => await this.alpaca.createOrder(params),
      { ...breakerOptions, name: 'PlaceOrder', timeout: 10000 } // Longer timeout for orders
    );

    // Log circuit breaker events
    [this.getQuoteBreaker, this.getBarsBreaker, this.getAccountBreaker, this.placeOrderBreaker].forEach(breaker => {
      breaker.on('open', () => {
        console.warn(`⚠️  Circuit breaker OPENED for ${breaker.name}`);
      });

      breaker.on('halfOpen', () => {
        console.log(`🔄 Circuit breaker HALF-OPEN for ${breaker.name}, testing...`);
      });

      breaker.on('close', () => {
        console.log(`✅ Circuit breaker CLOSED for ${breaker.name}`);
      });

      breaker.on('fallback', (result) => {
        console.log(`🔀 Circuit breaker FALLBACK used for ${breaker.name}`);
      });
    });

    // Add fallback for getQuote - use Redis cache
    this.getQuoteBreaker.fallback(async (symbol) => {
      console.log(`📦 Using cached quote for ${symbol}`);
      const cached = await this.redis.getCachedQuote(symbol);
      if (cached) {
        return cached;
      }
      throw new Error('No cached data available');
    });

    // Add fallback for getBars - use Redis cache
    this.getBarsBreaker.fallback(async (symbol, options) => {
      console.log(`📦 Using cached bars for ${symbol}`);
      const timeframe = options?.timeframe || '1Min';
      const cached = await this.redis.getCachedBars(symbol, timeframe);
      if (cached) {
        return cached;
      }
      throw new Error('No cached data available');
    });
  }

  async initialize() {
    try {
      // Test connection
      const account = await this.alpaca.getAccount();
      console.log('Alpaca account connected:', account.account_number);

      // Initialize data stream
      this.dataStream = this.alpaca.data_stream_v2;

      return true;
    } catch (error) {
      console.error('Failed to initialize Alpaca:', error);
      throw error;
    }
  }

  async getAccount() {
    try {
      return await this.getAccountBreaker.fire();
    } catch (error) {
      console.error('Failed to get account:', error.message);
      throw error;
    }
  }

  async getPositions() {
    return await this.alpaca.getPositions();
  }

  async getPosition(symbol) {
    try {
      return await this.alpaca.getPosition(symbol);
    } catch (error) {
      if (error.message.includes('position does not exist')) {
        return null;
      }
      throw error;
    }
  }

  async getOrders(status = 'open') {
    return await this.alpaca.getOrders({ status });
  }

  async placeOrder(params) {
    const {
      symbol,
      qty,
      side,
      type = 'market',
      time_in_force = 'gtc',
      limit_price,
      stop_price
    } = params;

    try {
      const order = await this.placeOrderBreaker.fire({
        symbol,
        qty,
        side,
        type,
        time_in_force,
        limit_price,
        stop_price
      });

      console.log('Order placed:', order);
      this.emit('orderPlaced', order);
      return order;
    } catch (error) {
      console.error('Failed to place order:', error);
      throw error;
    }
  }

  async cancelOrder(orderId) {
    return await this.alpaca.cancelOrder(orderId);
  }

  async getQuote(symbol) {
    try {
      // Try to get from cache first
      const cached = await this.redis.getCachedQuote(symbol);
      if (cached) {
        return cached;
      }

      // Use circuit breaker to fetch from Alpaca
      const quote = await this.getQuoteBreaker.fire(symbol);

      // Cache the result
      await this.redis.cacheQuote(symbol, quote);

      return quote;
    } catch (error) {
      console.error(`Failed to get quote for ${symbol}:`, error.message);
      throw error;
    }
  }

  async getBars(symbol, options = {}) {
    const {
      timeframe = '1Min',
      start,
      end,
      limit = 100
    } = options;

    try {
      // Try to get from cache first (only for recent data without custom date range)
      if (!start && !end) {
        const cached = await this.redis.getCachedBars(symbol, timeframe);
        if (cached) {
          return cached;
        }
      }

      // Use circuit breaker to fetch from Alpaca
      const barArray = await this.getBarsBreaker.fire(symbol, {
        timeframe,
        start,
        end,
        limit
      });

      // Cache the result (only for recent data)
      if (!start && !end) {
        await this.redis.cacheBars(symbol, timeframe, barArray);
      }

      return barArray;
    } catch (error) {
      console.error(`Failed to get bars for ${symbol}:`, error.message);
      throw error;
    }
  }

  async subscribeToSymbols(symbols, callback) {
    if (!Array.isArray(symbols)) {
      symbols = [symbols];
    }

    symbols.forEach(symbol => this.subscribedSymbols.add(symbol));

    // WebSocket subscriptions are disabled due to Alpaca SDK connection issues
    // Use REST API snapshots instead for real-time data
    console.log('WebSocket subscriptions disabled, use REST API for market data:', symbols);
  }

  async unsubscribeFromSymbols(symbols) {
    if (!Array.isArray(symbols)) {
      symbols = [symbols];
    }

    symbols.forEach(symbol => this.subscribedSymbols.delete(symbol));
    // WebSocket disabled - no action needed
    console.log('Unsubscribed from symbols:', symbols);
  }

  async getSnapshots(symbols) {
    if (!Array.isArray(symbols)) {
      symbols = [symbols];
    }

    try {
      // Use direct API call instead of SDK method for better reliability
      const symbolsParam = symbols.join(',');
      const response = await fetch(
        `https://data.alpaca.markets/v2/stocks/snapshots?symbols=${symbolsParam}`,
        {
          headers: {
            'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
            'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to get snapshots:', error);
      throw error;
    }
  }

  /**
   * Get all tradable US stocks from Alpaca
   * @returns {Promise<Array>} Array of assets with symbol, name, exchange
   */
  async getAllAssets() {
    try {
      const assets = await this.alpaca.getAssets({
        status: 'active',
        asset_class: 'us_equity'
      });

      // Filter to only tradable stocks and format response
      return assets
        .filter(asset => asset.tradable && asset.status === 'active')
        .map(asset => ({
          symbol: asset.symbol,
          name: asset.name,
          exchange: asset.exchange,
          class: asset.class
        }))
        .sort((a, b) => a.symbol.localeCompare(b.symbol));
    } catch (error) {
      console.error('Failed to fetch assets from Alpaca:', error);
      throw error;
    }
  }

  /**
   * Get company domain from company name for logo lookup
   * @param {string} name - Company name
   * @param {string} symbol - Stock symbol
   * @returns {string} Domain for logo lookup
   */
  getCompanyDomain(name, symbol) {
    // Common company domain mappings
    const domainMap = {
      'AAPL': 'apple.com',
      'MSFT': 'microsoft.com',
      'GOOGL': 'google.com',
      'GOOG': 'google.com',
      'AMZN': 'amazon.com',
      'META': 'meta.com',
      'TSLA': 'tesla.com',
      'NVDA': 'nvidia.com',
      'BRK.A': 'berkshirehathaway.com',
      'BRK.B': 'berkshirehathaway.com',
      'JPM': 'jpmorganchase.com',
      'V': 'visa.com',
      'WMT': 'walmart.com',
      'MA': 'mastercard.com',
      'UNH': 'unitedhealthgroup.com',
      'HD': 'homedepot.com',
      'PG': 'pg.com',
      'DIS': 'disney.com',
      'BAC': 'bankofamerica.com',
      'NFLX': 'netflix.com',
      'ADBE': 'adobe.com',
      'CRM': 'salesforce.com',
      'CSCO': 'cisco.com',
      'INTC': 'intel.com',
      'AMD': 'amd.com',
      'PYPL': 'paypal.com',
      'ORCL': 'oracle.com',
      'IBM': 'ibm.com',
      'COIN': 'coinbase.com',
      'SQ': 'squareup.com',
      'SNAP': 'snap.com',
      'UBER': 'uber.com',
      'LYFT': 'lyft.com',
      'SPOT': 'spotify.com',
      'SHOP': 'shopify.com',
      'TWTR': 'twitter.com',
      'X': 'x.com',
      'ABNB': 'airbnb.com',
      'RBLX': 'roblox.com',
      'SNOW': 'snowflake.com',
      'ZM': 'zoom.us',
      'DOCU': 'docusign.com',
      'PLTR': 'palantir.com',
      'DASH': 'doordash.com'
    };

    // Check if we have a direct mapping
    if (domainMap[symbol]) {
      return domainMap[symbol];
    }

    // Extract domain from company name
    // Remove common suffixes and convert to domain format
    let domain = name
      .toLowerCase()
      .replace(/\s*(inc\.?|corp\.?|corporation|company|co\.?|ltd\.?|llc|holdings?|group|international|technologies?)\s*/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();

    return `${domain}.com`;
  }

  /**
   * Get logo from Alpaca Logos API
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Logo data from Alpaca
   */
  async getLogo(symbol) {
    try {
      const endpoint = `https://data.alpaca.markets/v1beta1/logos/${symbol}`;
      const { data } = await axios.get(endpoint, {
        headers: {
          'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
          'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY,
        },
      });
      return data;
    } catch (error) {
      console.error(`Failed to get logo for ${symbol}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Search stocks by symbol or company name
   * @param {string} query - Search query
   * @param {number} limit - Maximum results to return
   * @returns {Promise<Array>} Matching assets
   */
  async searchAssets(query, limit = 20) {
    const allAssets = await this.getAllAssets();
    const searchTerm = query.toLowerCase();

    const results = allAssets.filter(asset =>
      asset.symbol.toLowerCase().includes(searchTerm) ||
      asset.name.toLowerCase().includes(searchTerm)
    );

    // Add Clearbit logo URLs using company domains
    return results.slice(0, limit).map(asset => {
      const domain = this.getCompanyDomain(asset.name, asset.symbol);
      return {
        ...asset,
        logo_url: `https://logo.clearbit.com/${domain}`
      };
    });
  }
}

module.exports = AlpacaService;
