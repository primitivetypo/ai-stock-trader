const EventEmitter = require('events');

class VirtualPortfolioService extends EventEmitter {
  constructor(alpacaService) {
    super();
    this.alpacaService = alpacaService;
    this.portfolios = new Map(); // userId -> portfolio
    this.orderIdCounter = 1;
  }

  // Initialize portfolio for new user
  createPortfolio(userId) {
    if (!this.portfolios.has(userId)) {
      this.portfolios.set(userId, {
        cash: 100000, // Starting virtual cash
        positions: new Map(), // symbol -> {qty, avgPrice, currentPrice}
        orders: [],
        trades: [],
        createdAt: new Date()
      });
      console.log(`Created virtual portfolio for user ${userId}`);
    }
    return this.portfolios.get(userId);
  }

  // Get user's portfolio
  getPortfolio(userId) {
    if (!this.portfolios.has(userId)) {
      return this.createPortfolio(userId);
    }
    return this.portfolios.get(userId);
  }

  // Get current market price from Alpaca
  async getCurrentPrice(symbol) {
    try {
      const quote = await this.alpacaService.getQuote(symbol);
      return (quote.BidPrice + quote.AskPrice) / 2; // Mid price
    } catch (error) {
      console.error(`Failed to get price for ${symbol}:`, error);
      // Fallback to last known price or throw
      throw error;
    }
  }

  // Place virtual order
  async placeOrder(userId, orderData) {
    const portfolio = this.getPortfolio(userId);
    const { symbol, qty, side, type, limit_price, time_in_force } = orderData;

    try {
      // Get current market price
      const currentPrice = await this.getCurrentPrice(symbol);
      const executionPrice = type === 'limit' ? limit_price : currentPrice;

      // Create order object
      const order = {
        id: `VIRT-${this.orderIdCounter++}`,
        userId,
        symbol,
        qty,
        side,
        type,
        limit_price,
        time_in_force: time_in_force || 'day',
        status: 'pending',
        submitted_at: new Date(),
        filled_qty: 0,
        filled_avg_price: null
      };

      // Check if order can be executed
      if (type === 'market' || (type === 'limit' && this.canExecuteLimit(side, currentPrice, limit_price))) {
        await this.executeOrder(userId, order, executionPrice);
      } else {
        // Store as pending limit order
        order.status = 'open';
        portfolio.orders.push(order);
      }

      return order;
    } catch (error) {
      console.error('Failed to place virtual order:', error);
      throw error;
    }
  }

  // Check if limit order should execute
  canExecuteLimit(side, currentPrice, limitPrice) {
    if (side === 'buy') {
      return currentPrice <= limitPrice;
    } else {
      return currentPrice >= limitPrice;
    }
  }

  // Execute order
  async executeOrder(userId, order, price) {
    const portfolio = this.getPortfolio(userId);
    const { symbol, qty, side } = order;

    if (side === 'buy') {
      const cost = qty * price;

      // Check if user has enough cash
      if (portfolio.cash < cost) {
        order.status = 'rejected';
        order.reject_reason = 'Insufficient funds';
        return order;
      }

      // Deduct cash
      portfolio.cash -= cost;

      // Add to positions
      if (!portfolio.positions.has(symbol)) {
        portfolio.positions.set(symbol, {
          symbol,
          qty: 0,
          avg_entry_price: 0,
          market_value: 0,
          unrealized_pl: 0,
          unrealized_plpc: 0
        });
      }

      const position = portfolio.positions.get(symbol);
      const totalQty = position.qty + qty;
      const totalCost = (position.avg_entry_price * position.qty) + (price * qty);
      position.avg_entry_price = totalCost / totalQty;
      position.qty = totalQty;

    } else if (side === 'sell') {
      // Check if user has position
      if (!portfolio.positions.has(symbol)) {
        order.status = 'rejected';
        order.reject_reason = 'No position to sell';
        return order;
      }

      const position = portfolio.positions.get(symbol);

      if (position.qty < qty) {
        order.status = 'rejected';
        order.reject_reason = 'Insufficient shares';
        return order;
      }

      // Add cash from sale
      const proceeds = qty * price;
      portfolio.cash += proceeds;

      // Update position
      position.qty -= qty;

      // Remove position if qty is 0
      if (position.qty === 0) {
        portfolio.positions.delete(symbol);
      }
    }

    // Mark order as filled
    order.status = 'filled';
    order.filled_qty = qty;
    order.filled_avg_price = price;
    order.filled_at = new Date();

    // Add to trades history
    portfolio.trades.push({
      ...order,
      price
    });

    // Remove from pending orders
    portfolio.orders = portfolio.orders.filter(o => o.id !== order.id);

    console.log(`Executed virtual trade for user ${userId}: ${side} ${qty} ${symbol} @ $${price}`);

    // Emit event
    this.emit('orderFilled', { userId, order });

    return order;
  }

  // Cancel order
  cancelOrder(userId, orderId) {
    const portfolio = this.getPortfolio(userId);
    const orderIndex = portfolio.orders.findIndex(o => o.id === orderId);

    if (orderIndex === -1) {
      throw new Error('Order not found');
    }

    const order = portfolio.orders[orderIndex];
    order.status = 'canceled';
    order.canceled_at = new Date();

    portfolio.orders.splice(orderIndex, 1);

    return order;
  }

  // Get user's positions
  async getPositions(userId) {
    const portfolio = this.getPortfolio(userId);
    const positions = Array.from(portfolio.positions.values());

    // Update current prices and P&L
    for (const position of positions) {
      try {
        const currentPrice = await this.getCurrentPrice(position.symbol);
        position.current_price = currentPrice;
        position.market_value = position.qty * currentPrice;
        position.unrealized_pl = position.market_value - (position.qty * position.avg_entry_price);
        position.unrealized_plpc = position.unrealized_pl / (position.qty * position.avg_entry_price);
      } catch (error) {
        console.error(`Failed to update position for ${position.symbol}:`, error);
      }
    }

    return positions;
  }

  // Get user's orders
  getOrders(userId, status = 'all') {
    const portfolio = this.getPortfolio(userId);

    if (status === 'all') {
      return [...portfolio.orders, ...portfolio.trades];
    } else if (status === 'open') {
      return portfolio.orders.filter(o => o.status === 'open');
    } else if (status === 'closed') {
      return portfolio.trades;
    }

    return portfolio.orders.filter(o => o.status === status);
  }

  // Get account summary
  async getAccount(userId) {
    const portfolio = this.getPortfolio(userId);
    const positions = await this.getPositions(userId);

    const portfolioValue = positions.reduce((sum, p) => sum + p.market_value, 0);
    const equity = portfolio.cash + portfolioValue;
    const lastEquity = 100000; // Starting amount (should track daily)

    return {
      account_number: `VIRT-${userId}`,
      status: 'ACTIVE',
      currency: 'USD',
      cash: portfolio.cash.toFixed(2),
      portfolio_value: portfolioValue.toFixed(2),
      equity: equity.toFixed(2),
      last_equity: lastEquity.toFixed(2),
      buying_power: (portfolio.cash * 2).toFixed(2), // 2x for margin
      pattern_day_trader: false,
      trading_blocked: false,
      transfers_blocked: false,
      account_blocked: false,
      created_at: portfolio.createdAt
    };
  }

  // Check pending limit orders and execute if price reached
  async checkPendingOrders() {
    for (const [userId, portfolio] of this.portfolios) {
      for (const order of portfolio.orders) {
        if (order.status === 'open' && order.type === 'limit') {
          try {
            const currentPrice = await this.getCurrentPrice(order.symbol);

            if (this.canExecuteLimit(order.side, currentPrice, order.limit_price)) {
              await this.executeOrder(userId, order, order.limit_price);
            }
          } catch (error) {
            console.error('Failed to check pending order:', error);
          }
        }
      }
    }
  }

  // Get all portfolios (for admin/leaderboard)
  async getAllPortfolios() {
    const results = [];

    for (const [userId, portfolio] of this.portfolios) {
      const account = await this.getAccount(userId);
      results.push({
        userId,
        equity: parseFloat(account.equity),
        cash: parseFloat(account.cash),
        portfolioValue: parseFloat(account.portfolio_value),
        return: ((parseFloat(account.equity) - 100000) / 100000) * 100
      });
    }

    // Sort by return
    results.sort((a, b) => b.return - a.return);

    return results;
  }

  // Start periodic order checking
  startOrderMonitoring() {
    // Check pending orders every 10 seconds
    this.orderCheckInterval = setInterval(() => {
      this.checkPendingOrders();
    }, 10000);

    console.log('Started virtual order monitoring');
  }

  stopOrderMonitoring() {
    if (this.orderCheckInterval) {
      clearInterval(this.orderCheckInterval);
      console.log('Stopped virtual order monitoring');
    }
  }
}

module.exports = VirtualPortfolioService;
