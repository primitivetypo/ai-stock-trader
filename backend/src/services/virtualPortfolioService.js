const EventEmitter = require('events');
const pool = require('../db/database');

class VirtualPortfolioService extends EventEmitter {
  constructor(alpacaService) {
    super();
    this.alpacaService = alpacaService;
  }

  // Initialize portfolio for new user
  async createPortfolio(userId) {
    const client = await pool.connect();
    try {
      // Check if portfolio already exists
      const checkResult = await client.query(
        'SELECT user_id FROM portfolios WHERE user_id = $1',
        [userId]
      );

      if (checkResult.rows.length > 0) {
        return await this.getPortfolio(userId);
      }

      // Create new portfolio
      const result = await client.query(
        `INSERT INTO portfolios (user_id, cash, last_equity, created_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [userId, 100000.00, 100000.00]
      );

      console.log(`Created virtual portfolio for user ${userId}`);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Get user's portfolio
  async getPortfolio(userId) {
    const result = await pool.query(
      'SELECT * FROM portfolios WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return await this.createPortfolio(userId);
    }

    return result.rows[0];
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
    const { symbol, qty, side, type, limit_price, time_in_force } = orderData;
    const client = await pool.connect();

    try {
      // Get current market price
      const currentPrice = await this.getCurrentPrice(symbol);
      const executionPrice = type === 'limit' ? limit_price : currentPrice;

      // Generate unique order ID
      const orderId = `VIRT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create order object
      const order = {
        id: orderId,
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
        await client.query(
          `INSERT INTO orders (id, user_id, symbol, qty, side, type, time_in_force, limit_price, status, filled_qty, submitted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [orderId, userId, symbol, qty, side, type, time_in_force || 'day', limit_price, 'open', 0, new Date()]
        );
      }

      return order;
    } catch (error) {
      console.error('Failed to place virtual order:', error);
      throw error;
    } finally {
      client.release();
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
    const { symbol, qty, side, id: orderId } = order;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get current portfolio
      const portfolioResult = await client.query(
        'SELECT * FROM portfolios WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (portfolioResult.rows.length === 0) {
        throw new Error('Portfolio not found');
      }

      const portfolio = portfolioResult.rows[0];

      if (side === 'buy') {
        const cost = qty * price;

        // Check if user has enough cash
        if (parseFloat(portfolio.cash) < cost) {
          order.status = 'rejected';
          order.reject_reason = 'Insufficient funds';

          // Insert rejected order
          await client.query(
            `INSERT INTO orders (id, user_id, symbol, qty, side, type, time_in_force, limit_price, status, filled_qty, submitted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO UPDATE SET status = $9`,
            [orderId, userId, symbol, qty, side, order.type, order.time_in_force, order.limit_price, 'rejected', 0, order.submitted_at]
          );

          await client.query('COMMIT');
          return order;
        }

        // Deduct cash
        await client.query(
          'UPDATE portfolios SET cash = cash - $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
          [cost, userId]
        );

        // Get existing position if any
        const positionResult = await client.query(
          'SELECT * FROM positions WHERE user_id = $1 AND symbol = $2',
          [userId, symbol]
        );

        if (positionResult.rows.length > 0) {
          // Update existing position
          const position = positionResult.rows[0];
          const currentQty = parseInt(position.qty);
          const totalQty = currentQty + qty;
          const totalCost = (parseFloat(position.avg_entry_price) * currentQty) + (price * qty);
          const newAvgPrice = totalCost / totalQty;

          await client.query(
            `UPDATE positions
             SET qty = $1, avg_entry_price = $2, cost_basis = $3, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $4 AND symbol = $5`,
            [totalQty, newAvgPrice, totalQty * newAvgPrice, userId, symbol]
          );
        } else {
          // Create new position
          await client.query(
            `INSERT INTO positions (user_id, symbol, qty, side, avg_entry_price, cost_basis, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [userId, symbol, qty, 'long', price, qty * price]
          );
        }

      } else if (side === 'sell') {
        // Get existing position
        const positionResult = await client.query(
          'SELECT * FROM positions WHERE user_id = $1 AND symbol = $2',
          [userId, symbol]
        );

        if (positionResult.rows.length === 0) {
          order.status = 'rejected';
          order.reject_reason = 'No position to sell';

          await client.query(
            `INSERT INTO orders (id, user_id, symbol, qty, side, type, time_in_force, limit_price, status, filled_qty, submitted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO UPDATE SET status = $9`,
            [orderId, userId, symbol, qty, side, order.type, order.time_in_force, order.limit_price, 'rejected', 0, order.submitted_at]
          );

          await client.query('COMMIT');
          return order;
        }

        const position = positionResult.rows[0];
        const currentQty = parseInt(position.qty);

        if (currentQty < qty) {
          order.status = 'rejected';
          order.reject_reason = 'Insufficient shares';

          await client.query(
            `INSERT INTO orders (id, user_id, symbol, qty, side, type, time_in_force, limit_price, status, filled_qty, submitted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO UPDATE SET status = $9`,
            [orderId, userId, symbol, qty, side, order.type, order.time_in_force, order.limit_price, 'rejected', 0, order.submitted_at]
          );

          await client.query('COMMIT');
          return order;
        }

        // Add cash from sale
        const proceeds = qty * price;
        await client.query(
          'UPDATE portfolios SET cash = cash + $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
          [proceeds, userId]
        );

        // Update position
        const newQty = currentQty - qty;
        if (newQty === 0) {
          // Remove position if qty is 0
          await client.query(
            'DELETE FROM positions WHERE user_id = $1 AND symbol = $2',
            [userId, symbol]
          );
        } else {
          await client.query(
            'UPDATE positions SET qty = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND symbol = $3',
            [newQty, userId, symbol]
          );
        }
      }

      // Mark order as filled
      order.status = 'filled';
      order.filled_qty = qty;
      order.filled_avg_price = price;
      order.filled_at = new Date();

      // Insert or update order as filled
      await client.query(
        `INSERT INTO orders (id, user_id, symbol, qty, side, type, time_in_force, limit_price, status, filled_qty, filled_avg_price, submitted_at, filled_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE
         SET status = $9, filled_qty = $10, filled_avg_price = $11, filled_at = $13`,
        [orderId, userId, symbol, qty, side, order.type, order.time_in_force, order.limit_price, 'filled', qty, price, order.submitted_at, order.filled_at]
      );

      // Delete from open orders if it was there
      await client.query(
        'DELETE FROM orders WHERE id = $1 AND status = $2',
        [orderId, 'open']
      );

      await client.query('COMMIT');

      console.log(`Executed virtual trade for user ${userId}: ${side} ${qty} ${symbol} @ $${price}`);

      // Emit event
      this.emit('orderFilled', { userId, order });

      return order;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Cancel order
  async cancelOrder(userId, orderId) {
    const client = await pool.connect();
    try {
      // Get the order
      const orderResult = await client.query(
        'SELECT * FROM orders WHERE id = $1 AND user_id = $2 AND status = $3',
        [orderId, userId, 'open']
      );

      if (orderResult.rows.length === 0) {
        throw new Error('Order not found');
      }

      const order = orderResult.rows[0];

      // Update order status to canceled
      await client.query(
        'UPDATE orders SET status = $1, cancelled_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['canceled', orderId]
      );

      order.status = 'canceled';
      order.cancelled_at = new Date();

      return order;
    } finally {
      client.release();
    }
  }

  // Get user's positions
  async getPositions(userId) {
    const result = await pool.query(
      'SELECT * FROM positions WHERE user_id = $1',
      [userId]
    );

    const positions = result.rows;

    // Update current prices and P&L
    for (const position of positions) {
      try {
        const currentPrice = await this.getCurrentPrice(position.symbol);
        const qty = parseInt(position.qty);
        const avgEntryPrice = parseFloat(position.avg_entry_price);
        const marketValue = qty * currentPrice;
        const unrealizedPl = marketValue - (qty * avgEntryPrice);
        const unrealizedPlpc = unrealizedPl / (qty * avgEntryPrice);

        // Update position in database
        await pool.query(
          `UPDATE positions
           SET current_price = $1, market_value = $2, unrealized_pl = $3, unrealized_plpc = $4, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $5 AND symbol = $6`,
          [currentPrice, marketValue, unrealizedPl, unrealizedPlpc, userId, position.symbol]
        );

        // Update the position object for return
        position.current_price = currentPrice;
        position.market_value = marketValue;
        position.unrealized_pl = unrealizedPl;
        position.unrealized_plpc = unrealizedPlpc;
      } catch (error) {
        console.error(`Failed to update position for ${position.symbol}:`, error);
      }
    }

    return positions;
  }

  // Get user's orders
  async getOrders(userId, status = 'all') {
    let query;
    let params;

    if (status === 'all') {
      query = 'SELECT * FROM orders WHERE user_id = $1 ORDER BY submitted_at DESC';
      params = [userId];
    } else if (status === 'open') {
      query = 'SELECT * FROM orders WHERE user_id = $1 AND status = $2 ORDER BY submitted_at DESC';
      params = [userId, 'open'];
    } else if (status === 'closed') {
      query = 'SELECT * FROM orders WHERE user_id = $1 AND status IN ($2, $3, $4) ORDER BY submitted_at DESC';
      params = [userId, 'filled', 'canceled', 'rejected'];
    } else {
      query = 'SELECT * FROM orders WHERE user_id = $1 AND status = $2 ORDER BY submitted_at DESC';
      params = [userId, status];
    }

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get account summary
  async getAccount(userId) {
    const portfolio = await this.getPortfolio(userId);
    const positions = await this.getPositions(userId);

    const portfolioValue = positions.reduce((sum, p) => sum + parseFloat(p.market_value || 0), 0);
    const cash = parseFloat(portfolio.cash);
    const equity = cash + portfolioValue;
    const lastEquity = parseFloat(portfolio.last_equity || 100000);

    return {
      account_number: `VIRT-${userId}`,
      status: 'ACTIVE',
      currency: 'USD',
      cash: cash.toFixed(2),
      portfolio_value: portfolioValue.toFixed(2),
      equity: equity.toFixed(2),
      last_equity: lastEquity.toFixed(2),
      buying_power: (cash * 2).toFixed(2), // 2x for margin
      pattern_day_trader: false,
      trading_blocked: false,
      transfers_blocked: false,
      account_blocked: false,
      created_at: portfolio.created_at
    };
  }

  // Update position prices without re-fetching
  async updatePositionPrices(userId) {
    const positions = await this.getPositions(userId);
    return positions;
  }

  // Check pending limit orders and execute if price reached
  async checkPendingOrders() {
    const result = await pool.query(
      'SELECT DISTINCT user_id FROM orders WHERE status = $1 AND type = $2',
      ['open', 'limit']
    );

    const userIds = result.rows.map(row => row.user_id);

    for (const userId of userIds) {
      const ordersResult = await pool.query(
        'SELECT * FROM orders WHERE user_id = $1 AND status = $2 AND type = $3',
        [userId, 'open', 'limit']
      );

      for (const order of ordersResult.rows) {
        try {
          const currentPrice = await this.getCurrentPrice(order.symbol);

          if (this.canExecuteLimit(order.side, currentPrice, parseFloat(order.limit_price))) {
            await this.executeOrder(userId, order, parseFloat(order.limit_price));
          }
        } catch (error) {
          console.error('Failed to check pending order:', error);
        }
      }
    }
  }

  // Get all portfolios (for admin/leaderboard)
  async getAllPortfolios() {
    const portfoliosResult = await pool.query(
      'SELECT user_id FROM portfolios'
    );

    const results = [];

    for (const row of portfoliosResult.rows) {
      try {
        const account = await this.getAccount(row.user_id);
        results.push({
          userId: row.user_id,
          equity: parseFloat(account.equity),
          cash: parseFloat(account.cash),
          portfolioValue: parseFloat(account.portfolio_value),
          return: ((parseFloat(account.equity) - 100000) / 100000) * 100
        });
      } catch (error) {
        console.error(`Failed to get account for user ${row.user_id}:`, error);
      }
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
