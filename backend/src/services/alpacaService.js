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

    try {
      // Connect first before subscribing
      await this.dataStream.connect();

      // Subscribe to trades
      this.dataStream.onStockTrade((trade) => {
        if (this.subscribedSymbols.has(trade.Symbol)) {
          callback({
            type: 'trade',
            symbol: trade.Symbol,
            price: trade.Price,
            size: trade.Size,
            timestamp: trade.Timestamp
          });
        }
      });

      // Subscribe to quotes
      this.dataStream.onStockQuote((quote) => {
        if (this.subscribedSymbols.has(quote.Symbol)) {
          callback({
            type: 'quote',
            symbol: quote.Symbol,
            bidPrice: quote.BidPrice,
            bidSize: quote.BidSize,
            askPrice: quote.AskPrice,
            askSize: quote.AskSize,
            timestamp: quote.Timestamp
          });
        }
      });

      // Subscribe to bars
      this.dataStream.onStockBar((bar) => {
        if (this.subscribedSymbols.has(bar.Symbol)) {
          callback({
            type: 'bar',
            symbol: bar.Symbol,
            open: bar.OpenPrice,
            high: bar.HighPrice,
            low: bar.LowPrice,
            close: bar.ClosePrice,
            volume: bar.Volume,
            timestamp: bar.Timestamp
          });
        }
      });

      // Subscribe after handlers are set up
      this.dataStream.subscribeForTrades(symbols);
      this.dataStream.subscribeForQuotes(symbols);
      this.dataStream.subscribeForBars(symbols);

      console.log('Subscribed to symbols:', symbols);
    } catch (error) {
      console.error('Failed to subscribe to symbols:', error);
    }
  }

  async unsubscribeFromSymbols(symbols) {
    if (!Array.isArray(symbols)) {
      symbols = [symbols];
    }

    symbols.forEach(symbol => this.subscribedSymbols.delete(symbol));

    this.dataStream.unsubscribeFromTrades(symbols);
    this.dataStream.unsubscribeFromQuotes(symbols);
    this.dataStream.unsubscribeFromBars(symbols);

    console.log('Unsubscribed from symbols:', symbols);
  }

  async getSnapshots(symbols) {
    if (!Array.isArray(symbols)) {
      symbols = [symbols];
    }

    const snapshots = await this.alpaca.getSnapshots(symbols);
    return snapshots;
  }
}

module.exports = AlpacaService;
