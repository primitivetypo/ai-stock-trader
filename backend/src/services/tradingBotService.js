const EventEmitter = require('events');
const pool = require('../db/database');

/**
 * Trading Bot Service
 * Manages autonomous trading bots that run experiments with different strategies
 */
class TradingBotService extends EventEmitter {
  constructor(virtualPortfolioService, alpacaService) {
    super();
    this.virtualPortfolioService = virtualPortfolioService;
    this.alpacaService = alpacaService;
    this.activeIntervals = new Map(); // botId -> interval reference (not stored in DB)
    this.strategies = this.initializeStrategies();
  }

  /**
   * Define available trading strategies
   */
  initializeStrategies() {
    return {
      'volume-spike': {
        name: 'Volume Spike Strategy',
        description: 'Buys on abnormal volume spikes near support, sells at resistance',
        config: {
          volumeThreshold: 2.0, // Z-score
          supportDistance: 0.02, // 2% from support
          resistanceTarget: 0.03, // 3% profit target
          stopLoss: 0.02, // 2% stop loss
          positionSize: 0.1 // 10% of portfolio per trade
        }
      },
      'momentum': {
        name: 'Momentum Strategy',
        description: 'Follows price momentum with moving average crossovers',
        config: {
          fastMA: 5, // 5-period fast MA
          slowMA: 20, // 20-period slow MA
          profitTarget: 0.05, // 5% profit target
          stopLoss: 0.025, // 2.5% stop loss
          positionSize: 0.15
        }
      },
      'mean-reversion': {
        name: 'Mean Reversion Strategy',
        description: 'Buys oversold, sells overbought based on RSI',
        config: {
          rsiPeriod: 14,
          oversoldLevel: 30,
          overboughtLevel: 70,
          profitTarget: 0.03,
          stopLoss: 0.02,
          positionSize: 0.12
        }
      },
      'breakout': {
        name: 'Breakout Strategy',
        description: 'Trades breakouts above resistance or below support',
        config: {
          breakoutThreshold: 0.015, // 1.5% above resistance
          volumeConfirmation: 1.5, // 1.5x avg volume
          profitTarget: 0.06,
          stopLoss: 0.03,
          positionSize: 0.08
        }
      },
      'support-resistance': {
        name: 'Support/Resistance Bounce',
        description: 'Buys at support levels, sells at resistance',
        config: {
          supportTolerance: 0.005, // 0.5% from support
          resistanceTolerance: 0.005,
          profitTarget: 0.04,
          stopLoss: 0.015,
          positionSize: 0.1
        }
      }
    };
  }

  /**
   * Create a new experiment with multiple bots
   */
  async createExperiment(userId, config) {
    const experimentId = `exp-${Date.now()}`;
    const { botCount, strategies, watchlist, duration } = config;

    // Validate strategies
    const selectedStrategies = strategies || Object.keys(this.strategies).slice(0, botCount);
    if (selectedStrategies.length !== botCount) {
      throw new Error(`Need ${botCount} strategies for ${botCount} bots`);
    }

    const defaultWatchlist = watchlist || ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL'];

    // Insert experiment into database
    const result = await pool.query(
      `INSERT INTO experiments (id, user_id, bot_count, status, watchlist, duration)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [experimentId, userId, botCount, 'created', JSON.stringify(defaultWatchlist), duration]
    );

    const experiment = result.rows[0];

    // Create bots for this experiment
    const botIds = [];
    for (let i = 0; i < botCount; i++) {
      const strategyKey = selectedStrategies[i];
      const botId = `${experimentId}-bot-${i + 1}`;

      await this.createBot(botId, experimentId, userId, strategyKey, defaultWatchlist);
      botIds.push(botId);
    }

    console.log(`Created experiment ${experimentId} with ${botCount} bots`);

    return {
      id: experiment.id,
      userId: experiment.user_id,
      botCount: experiment.bot_count,
      status: experiment.status,
      watchlist: experiment.watchlist,
      startTime: experiment.start_time,
      endTime: experiment.end_time,
      duration: experiment.duration,
      createdAt: experiment.created_at,
      bots: botIds
    };
  }

  /**
   * Create individual bot with strategy
   */
  async createBot(botId, experimentId, userId, strategyKey, watchlist) {
    const strategy = this.strategies[strategyKey];
    if (!strategy) {
      throw new Error(`Unknown strategy: ${strategyKey}`);
    }

    // Create virtual portfolio for this bot
    const botUserId = `${userId}-${botId}`;
    await this.virtualPortfolioService.createPortfolio(botUserId);

    // Insert bot into database
    await pool.query(
      `INSERT INTO bots (id, experiment_id, user_id, strategy_key, strategy_name, config, watchlist, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [botId, experimentId, botUserId, strategyKey, strategy.name, JSON.stringify(strategy.config), JSON.stringify(watchlist), 'idle']
    );

    // Insert initial metrics
    await pool.query(
      `INSERT INTO bot_metrics (bot_id, total_trades, winning_trades, losing_trades, total_profit, current_equity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [botId, 0, 0, 0, 0, 100000]
    );

    console.log(`Created bot ${botId} with ${strategy.name}`);

    return {
      id: botId,
      userId: botUserId,
      strategyKey,
      strategy: strategy.name,
      config: strategy.config,
      watchlist,
      status: 'idle'
    };
  }

  /**
   * Start an experiment (all bots start trading)
   */
  async startExperiment(experimentId) {
    // Update experiment status in database
    const result = await pool.query(
      `UPDATE experiments
       SET status = $1, start_time = $2
       WHERE id = $3
       RETURNING *`,
      ['running', new Date(), experimentId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const experiment = result.rows[0];

    // Get all bots for this experiment
    const botsResult = await pool.query(
      `SELECT id FROM bots WHERE experiment_id = $1`,
      [experimentId]
    );

    const botIds = botsResult.rows.map(row => row.id);

    // Start all bots
    for (const botId of botIds) {
      await this.startBot(botId);
    }

    console.log(`Started experiment ${experimentId}`);

    const experimentData = {
      id: experiment.id,
      userId: experiment.user_id,
      botCount: experiment.bot_count,
      status: experiment.status,
      watchlist: experiment.watchlist,
      startTime: experiment.start_time,
      endTime: experiment.end_time,
      duration: experiment.duration,
      bots: botIds
    };

    this.emit('experimentStarted', experimentData);

    return experimentData;
  }

  /**
   * Start individual bot
   */
  async startBot(botId) {
    // Update bot status in database
    const result = await pool.query(
      `UPDATE bots
       SET status = $1, start_time = $2
       WHERE id = $3
       RETURNING strategy_name`,
      ['running', new Date(), botId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Bot ${botId} not found`);
    }

    const strategyName = result.rows[0].strategy_name;

    // Start bot trading loop (stored in memory)
    const interval = setInterval(() => {
      this.executeBotLogic(botId);
    }, 30000); // Run every 30 seconds

    this.activeIntervals.set(botId, interval);

    console.log(`Started bot ${botId} with ${strategyName}`);
  }

  /**
   * Stop an experiment
   */
  async stopExperiment(experimentId) {
    // Get all bots for this experiment
    const botsResult = await pool.query(
      `SELECT id FROM bots WHERE experiment_id = $1`,
      [experimentId]
    );

    const botIds = botsResult.rows.map(row => row.id);

    // Stop all bots
    for (const botId of botIds) {
      await this.stopBot(botId);
    }

    // Update experiment status
    const result = await pool.query(
      `UPDATE experiments
       SET status = $1, end_time = $2
       WHERE id = $3
       RETURNING *`,
      ['stopped', new Date(), experimentId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const experiment = result.rows[0];

    // Calculate final results
    const results = await this.calculateExperimentResults(experimentId);

    console.log(`Stopped experiment ${experimentId}`);

    const experimentData = {
      id: experiment.id,
      userId: experiment.user_id,
      botCount: experiment.bot_count,
      status: experiment.status,
      watchlist: experiment.watchlist,
      startTime: experiment.start_time,
      endTime: experiment.end_time,
      duration: experiment.duration,
      bots: botIds,
      results
    };

    this.emit('experimentStopped', experimentData);

    return experimentData;
  }

  /**
   * Stop individual bot
   */
  async stopBot(botId) {
    // Get bot info for closing positions
    const botResult = await pool.query(
      `SELECT user_id FROM bots WHERE id = $1`,
      [botId]
    );

    if (botResult.rows.length === 0) {
      throw new Error(`Bot ${botId} not found`);
    }

    const botUserId = botResult.rows[0].user_id;

    // Update bot status
    await pool.query(
      `UPDATE bots
       SET status = $1, stop_time = $2
       WHERE id = $3`,
      ['stopped', new Date(), botId]
    );

    // Clear interval from memory
    const interval = this.activeIntervals.get(botId);
    if (interval) {
      clearInterval(interval);
      this.activeIntervals.delete(botId);
    }

    // Close all positions
    await this.closeAllPositions(botId, botUserId);

    console.log(`Stopped bot ${botId}`);
  }

  /**
   * Main bot trading logic - executes based on strategy
   */
  async executeBotLogic(botId) {
    try {
      // Get bot from database
      const bot = await this.getBot(botId);
      if (!bot || bot.status !== 'running') return;

      // Update market data for watchlist
      await this.updateMarketData(bot);

      // Check for exit conditions (sell signals)
      await this.checkExitConditions(bot);

      // Check for entry conditions (buy signals)
      await this.checkEntryConditions(bot);

      // Update bot metrics
      await this.updateBotMetrics(bot);

    } catch (error) {
      console.error(`Error in bot ${botId} logic:`, error);
    }
  }

  /**
   * Update market data for bot's watchlist
   */
  async updateMarketData(bot) {
    for (const symbol of bot.watchlist) {
      try {
        const quote = await this.alpacaService.getQuote(symbol);
        const bars = await this.alpacaService.getBars(symbol, '1Min', 100);

        // Get existing price history from database
        const historyResult = await pool.query(
          `SELECT prices, volumes FROM price_history WHERE bot_id = $1 AND symbol = $2`,
          [bot.id, symbol]
        );

        let prices = [];
        let volumes = [];

        if (historyResult.rows.length > 0) {
          prices = historyResult.rows[0].prices || [];
          volumes = historyResult.rows[0].volumes || [];
        }

        // Add new price
        prices.push(quote.ap);
        if (prices.length > 100) {
          prices.shift();
        }

        // Add new volume
        if (bars.length > 0) {
          volumes.push(bars[bars.length - 1].v);
          if (volumes.length > 100) {
            volumes.shift();
          }
        }

        // Update or insert price history
        await pool.query(
          `INSERT INTO price_history (bot_id, symbol, prices, volumes, updated_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (bot_id, symbol)
           DO UPDATE SET prices = $3, volumes = $4, updated_at = $5`,
          [bot.id, symbol, JSON.stringify(prices), JSON.stringify(volumes), new Date()]
        );

      } catch (error) {
        console.error(`Failed to update market data for ${symbol}:`, error.message);
      }
    }
  }

  /**
   * Check exit conditions for existing positions
   */
  async checkExitConditions(bot) {
    const positions = await this.virtualPortfolioService.getPositions(bot.userId);

    for (const position of positions) {
      const symbol = position.symbol;
      const entryPrice = parseFloat(position.avg_entry_price);

      try {
        const quote = await this.alpacaService.getQuote(symbol);
        const currentPrice = quote.ap;
        const priceChange = (currentPrice - entryPrice) / entryPrice;

        let shouldSell = false;
        let reason = '';

        // Get price history for this symbol
        const historyResult = await pool.query(
          `SELECT prices FROM price_history WHERE bot_id = $1 AND symbol = $2`,
          [bot.id, symbol]
        );
        const priceHistory = historyResult.rows.length > 0 ? historyResult.rows[0].prices : [];

        // Strategy-specific exit logic
        switch (bot.strategyKey) {
          case 'volume-spike':
            if (priceChange >= bot.config.resistanceTarget) {
              shouldSell = true;
              reason = 'Resistance target reached';
            } else if (priceChange <= -bot.config.stopLoss) {
              shouldSell = true;
              reason = 'Stop loss triggered';
            }
            break;

          case 'momentum':
            if (priceChange >= bot.config.profitTarget) {
              shouldSell = true;
              reason = 'Profit target reached';
            } else if (priceChange <= -bot.config.stopLoss) {
              shouldSell = true;
              reason = 'Stop loss triggered';
            }
            break;

          case 'mean-reversion':
            const rsi = this.calculateRSI(priceHistory, bot.config.rsiPeriod);
            if (rsi > bot.config.overboughtLevel || priceChange >= bot.config.profitTarget) {
              shouldSell = true;
              reason = 'Overbought or profit target';
            } else if (priceChange <= -bot.config.stopLoss) {
              shouldSell = true;
              reason = 'Stop loss triggered';
            }
            break;

          case 'breakout':
            if (priceChange >= bot.config.profitTarget) {
              shouldSell = true;
              reason = 'Profit target reached';
            } else if (priceChange <= -bot.config.stopLoss) {
              shouldSell = true;
              reason = 'Stop loss triggered';
            }
            break;

          case 'support-resistance':
            const resistance = await this.calculateResistance(symbol, priceHistory);
            if (currentPrice >= resistance * (1 - bot.config.resistanceTolerance)) {
              shouldSell = true;
              reason = 'Near resistance level';
            } else if (priceChange <= -bot.config.stopLoss) {
              shouldSell = true;
              reason = 'Stop loss triggered';
            }
            break;
        }

        // Execute sell if conditions met
        if (shouldSell) {
          await this.sellPosition(bot, position, reason);
        }
      } catch (error) {
        console.error(`Error checking exit for ${symbol}:`, error.message);
      }
    }
  }

  /**
   * Check entry conditions for new positions
   */
  async checkEntryConditions(bot) {
    const account = await this.virtualPortfolioService.getAccount(bot.userId);
    const availableCash = parseFloat(account.cash);

    for (const symbol of bot.watchlist) {
      try {
        const quote = await this.alpacaService.getQuote(symbol);
        const currentPrice = quote.ap;

        // Get price and volume history from database
        const historyResult = await pool.query(
          `SELECT prices, volumes FROM price_history WHERE bot_id = $1 AND symbol = $2`,
          [bot.id, symbol]
        );

        const priceHistory = historyResult.rows.length > 0 ? historyResult.rows[0].prices : [];
        const volumeHistory = historyResult.rows.length > 0 ? historyResult.rows[0].volumes : [];

        if (priceHistory.length < 20) continue; // Need enough history

        let shouldBuy = false;
        let reason = '';

        // Strategy-specific entry logic
        switch (bot.strategyKey) {
          case 'volume-spike':
            const volumeZScore = this.calculateZScore(volumeHistory);
            const support = await this.calculateSupport(symbol, priceHistory);
            if (volumeZScore > bot.config.volumeThreshold &&
                currentPrice <= support * (1 + bot.config.supportDistance)) {
              shouldBuy = true;
              reason = 'Volume spike near support';
            }
            break;

          case 'momentum':
            const fastMA = this.calculateMA(priceHistory, bot.config.fastMA);
            const slowMA = this.calculateMA(priceHistory, bot.config.slowMA);
            if (fastMA > slowMA && priceHistory[priceHistory.length - 2] <= slowMA) {
              shouldBuy = true;
              reason = 'MA crossover bullish';
            }
            break;

          case 'mean-reversion':
            const rsi = this.calculateRSI(priceHistory, bot.config.rsiPeriod);
            if (rsi < bot.config.oversoldLevel) {
              shouldBuy = true;
              reason = 'RSI oversold';
            }
            break;

          case 'breakout':
            const resistance = await this.calculateResistance(symbol, priceHistory);
            const avgVolume = volumeHistory.reduce((a, b) => a + b, 0) / volumeHistory.length;
            const currentVolume = volumeHistory[volumeHistory.length - 1];
            if (currentPrice > resistance * (1 + bot.config.breakoutThreshold) &&
                currentVolume > avgVolume * bot.config.volumeConfirmation) {
              shouldBuy = true;
              reason = 'Breakout with volume';
            }
            break;

          case 'support-resistance':
            const supportLevel = await this.calculateSupport(symbol, priceHistory);
            if (currentPrice <= supportLevel * (1 + bot.config.supportTolerance)) {
              shouldBuy = true;
              reason = 'At support level';
            }
            break;
        }

        // Execute buy if conditions met
        if (shouldBuy) {
          await this.buyPosition(bot, symbol, currentPrice, availableCash, reason);
        }
      } catch (error) {
        console.error(`Error checking entry for ${symbol}:`, error.message);
      }
    }
  }

  /**
   * Execute buy order for bot
   */
  async buyPosition(bot, symbol, currentPrice, availableCash, reason) {
    try {
      // Calculate position size
      const positionValue = availableCash * bot.config.positionSize;
      const qty = Math.floor(positionValue / currentPrice);

      if (qty < 1) return; // Not enough cash

      // Place order via virtual portfolio
      const order = await this.virtualPortfolioService.placeOrder(bot.userId, {
        symbol,
        qty,
        side: 'buy',
        type: 'market'
      });

      // Store trade in database
      await pool.query(
        `INSERT INTO bot_trades (bot_id, time, symbol, side, qty, price, reason, order_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [bot.id, new Date(), symbol, 'buy', qty, currentPrice, reason, order.id]
      );

      const trade = {
        time: new Date(),
        symbol,
        side: 'buy',
        qty,
        price: currentPrice,
        reason,
        orderId: order.id
      };

      console.log(`Bot ${bot.id} BUY: ${qty} ${symbol} @ $${currentPrice.toFixed(2)} - ${reason}`);
      this.emit('botTrade', { botId: bot.id, trade });

    } catch (error) {
      console.error(`Bot ${bot.id} failed to buy ${symbol}:`, error.message);
    }
  }

  /**
   * Execute sell order for bot
   */
  async sellPosition(bot, position, reason) {
    try {
      const symbol = position.symbol;
      const qty = parseInt(position.qty);

      // Place order via virtual portfolio
      const order = await this.virtualPortfolioService.placeOrder(bot.userId, {
        symbol,
        qty,
        side: 'sell',
        type: 'market'
      });

      const quote = await this.alpacaService.getQuote(symbol);

      // Store trade in database
      await pool.query(
        `INSERT INTO bot_trades (bot_id, time, symbol, side, qty, price, reason, order_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [bot.id, new Date(), symbol, 'sell', qty, quote.ap, reason, order.id]
      );

      const trade = {
        time: new Date(),
        symbol,
        side: 'sell',
        qty,
        price: quote.ap,
        reason,
        orderId: order.id
      };

      console.log(`Bot ${bot.id} SELL: ${qty} ${symbol} @ $${quote.ap.toFixed(2)} - ${reason}`);
      this.emit('botTrade', { botId: bot.id, trade });

    } catch (error) {
      console.error(`Bot ${bot.id} failed to sell ${position.symbol}:`, error.message);
    }
  }

  /**
   * Close all positions for a bot
   */
  async closeAllPositions(botId, botUserId) {
    const positions = await this.virtualPortfolioService.getPositions(botUserId);

    // Get bot data for sellPosition
    const bot = await this.getBot(botId);

    for (const position of positions) {
      await this.sellPosition(bot, position, 'Closing all positions');
    }
  }

  /**
   * Update bot performance metrics
   */
  async updateBotMetrics(bot) {
    try {
      const account = await this.virtualPortfolioService.getAccount(bot.userId);
      const currentEquity = parseFloat(account.equity);
      const totalProfit = currentEquity - 100000;

      // Get all trades from database
      const tradesResult = await pool.query(
        `SELECT * FROM bot_trades WHERE bot_id = $1 ORDER BY time ASC`,
        [bot.id]
      );

      const trades = tradesResult.rows;
      const buyTrades = trades.filter(t => t.side === 'buy');
      const sellTrades = trades.filter(t => t.side === 'sell');

      // Count wins/losses
      let wins = 0;
      let losses = 0;

      for (const sell of sellTrades) {
        const buy = buyTrades.find(b => b.symbol === sell.symbol && new Date(b.time) < new Date(sell.time));
        if (buy) {
          const profit = (parseFloat(sell.price) - parseFloat(buy.price)) * parseInt(sell.qty);
          if (profit > 0) wins++;
          else if (profit < 0) losses++;
        }
      }

      const totalTrades = wins + losses;

      // Update metrics in database
      await pool.query(
        `UPDATE bot_metrics
         SET total_trades = $1, winning_trades = $2, losing_trades = $3,
             total_profit = $4, current_equity = $5, updated_at = $6
         WHERE bot_id = $7`,
        [totalTrades, wins, losses, totalProfit, currentEquity, new Date(), bot.id]
      );

    } catch (error) {
      console.error(`Failed to update metrics for bot ${bot.id}:`, error.message);
    }
  }

  /**
   * Calculate experiment results
   */
  async calculateExperimentResults(experimentId) {
    // Get all bots for this experiment with their metrics
    const result = await pool.query(
      `SELECT b.id, b.strategy_name, m.total_trades, m.winning_trades,
              m.losing_trades, m.total_profit, m.current_equity
       FROM bots b
       LEFT JOIN bot_metrics m ON b.id = m.bot_id
       WHERE b.experiment_id = $1`,
      [experimentId]
    );

    const results = result.rows.map(row => ({
      botId: row.id,
      strategy: row.strategy_name,
      finalEquity: parseFloat(row.current_equity) || 100000,
      totalProfit: parseFloat(row.total_profit) || 0,
      returnPercent: ((parseFloat(row.current_equity || 100000) - 100000) / 100000) * 100,
      totalTrades: parseInt(row.total_trades) || 0,
      winningTrades: parseInt(row.winning_trades) || 0,
      losingTrades: parseInt(row.losing_trades) || 0,
      winRate: parseInt(row.total_trades) > 0
        ? (parseInt(row.winning_trades) / parseInt(row.total_trades)) * 100
        : 0
    }));

    // Sort by profit
    results.sort((a, b) => b.totalProfit - a.totalProfit);

    return results;
  }

  /**
   * Get experiment details
   */
  async getExperiment(experimentId) {
    const result = await pool.query(
      `SELECT * FROM experiments WHERE id = $1`,
      [experimentId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const exp = result.rows[0];

    // Get bot IDs for this experiment
    const botsResult = await pool.query(
      `SELECT id FROM bots WHERE experiment_id = $1`,
      [experimentId]
    );

    const botIds = botsResult.rows.map(row => row.id);

    return {
      id: exp.id,
      userId: exp.user_id,
      botCount: exp.bot_count,
      status: exp.status,
      watchlist: exp.watchlist,
      startTime: exp.start_time,
      endTime: exp.end_time,
      duration: exp.duration,
      createdAt: exp.created_at,
      bots: botIds
    };
  }

  /**
   * Get all experiments for a user
   */
  async getUserExperiments(userId) {
    const result = await pool.query(
      `SELECT * FROM experiments WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    const experiments = [];
    for (const exp of result.rows) {
      // Get bot IDs for each experiment
      const botsResult = await pool.query(
        `SELECT id FROM bots WHERE experiment_id = $1`,
        [exp.id]
      );

      const botIds = botsResult.rows.map(row => row.id);

      experiments.push({
        id: exp.id,
        userId: exp.user_id,
        botCount: exp.bot_count,
        status: exp.status,
        watchlist: exp.watchlist,
        startTime: exp.start_time,
        endTime: exp.end_time,
        duration: exp.duration,
        createdAt: exp.created_at,
        bots: botIds
      });
    }

    return experiments;
  }

  /**
   * Get bot details
   */
  async getBot(botId) {
    const result = await pool.query(
      `SELECT b.*, m.total_trades, m.winning_trades, m.losing_trades,
              m.total_profit, m.current_equity
       FROM bots b
       LEFT JOIN bot_metrics m ON b.id = m.bot_id
       WHERE b.id = $1`,
      [botId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const bot = result.rows[0];

    return {
      id: bot.id,
      userId: bot.user_id,
      experimentId: bot.experiment_id,
      strategyKey: bot.strategy_key,
      strategy: bot.strategy_name,
      config: bot.config,
      watchlist: bot.watchlist,
      status: bot.status,
      startTime: bot.start_time,
      stopTime: bot.stop_time,
      metrics: {
        totalTrades: parseInt(bot.total_trades) || 0,
        winningTrades: parseInt(bot.winning_trades) || 0,
        losingTrades: parseInt(bot.losing_trades) || 0,
        totalProfit: parseFloat(bot.total_profit) || 0,
        currentEquity: parseFloat(bot.current_equity) || 100000
      }
    };
  }

  /**
   * Get available strategies
   */
  getStrategies() {
    return this.strategies;
  }

  // ===== Technical Indicator Calculations =====

  calculateMA(prices, period) {
    if (prices.length < period) return prices[prices.length - 1];
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  calculateZScore(data) {
    if (data.length < 2) return 0;

    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    const current = data[data.length - 1];
    return (current - mean) / stdDev;
  }

  async calculateSupport(symbol, prices) {
    if (prices.length < 10) return Math.min(...prices);

    // Find local minima
    const minima = [];
    for (let i = 2; i < prices.length - 2; i++) {
      if (prices[i] < prices[i - 1] && prices[i] < prices[i - 2] &&
          prices[i] < prices[i + 1] && prices[i] < prices[i + 2]) {
        minima.push(prices[i]);
      }
    }

    return minima.length > 0
      ? minima.reduce((a, b) => a + b, 0) / minima.length
      : Math.min(...prices);
  }

  async calculateResistance(symbol, prices) {
    if (prices.length < 10) return Math.max(...prices);

    // Find local maxima
    const maxima = [];
    for (let i = 2; i < prices.length - 2; i++) {
      if (prices[i] > prices[i - 1] && prices[i] > prices[i - 2] &&
          prices[i] > prices[i + 1] && prices[i] > prices[i + 2]) {
        maxima.push(prices[i]);
      }
    }

    return maxima.length > 0
      ? maxima.reduce((a, b) => a + b, 0) / maxima.length
      : Math.max(...prices);
  }
}

module.exports = TradingBotService;
