const Alpaca = require('@alpacahq/alpaca-trade-api');
const EventEmitter = require('events');

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
    return await this.alpaca.getAccount();
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
      const order = await this.alpaca.createOrder({
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
      const quote = await this.alpaca.getLatestQuote(symbol);
      return quote;
    } catch (error) {
      console.error(`Failed to get quote for ${symbol}:`, error);
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
      const bars = await this.alpaca.getBarsV2(symbol, {
        timeframe,
        start,
        end,
        limit
      });

      const barArray = [];
      for await (let bar of bars) {
        barArray.push(bar);
      }

      return barArray;
    } catch (error) {
      console.error(`Failed to get bars for ${symbol}:`, error);
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

    const snapshots = await this.alpaca.getSnapshots(symbols);
    return snapshots;
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

    return results.slice(0, limit);
  }
}

module.exports = AlpacaService;
