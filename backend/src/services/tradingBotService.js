const EventEmitter = require('events');
const pool = require('../db/database');
const { getNewsAggregatorService } = require('./newsAggregatorService');
const { getAITradeAgentService } = require('./aiTradeAgentService');
const { getMarketDataCacheService } = require('./marketDataCacheService');
const {
  createStrategy,
  getAvailableStrategies,
  VWAPStrategy,
  BollingerSqueezeStrategy,
  RSIDivergenceStrategy,
  ORBStrategy,
  GapFillStrategy,
  TechnicalIndicators
} = require('../strategies');

/**
 * Trading Bot Service
 * Manages autonomous trading bots that run experiments with different strategies
 */
class TradingBotService extends EventEmitter {
  constructor(virtualPortfolioService, alpacaService, io = null) {
    super();
    this.virtualPortfolioService = virtualPortfolioService;
    this.alpacaService = alpacaService;
    this.io = io; // WebSocket instance for real-time updates
    this.bots = new Map(); // botId -> bot instance
    this.activeIntervals = new Map(); // botId -> interval reference (not stored in DB)
    this.newsListeners = new Map(); // botId -> news listener function
    this.strategies = this.initializeStrategies();

    // Initialize AI services
    this.newsAggregator = getNewsAggregatorService();
    this.aiTradeAgent = getAITradeAgentService();
    this.newsAggregatorStarted = false;

    // Initialize market data cache service
    this.marketDataCache = getMarketDataCacheService(alpacaService);
    this.cacheStarted = false;
  }

  /**
   * Define available trading strategies
   */
  initializeStrategies() {
    return {
      // === ORIGINAL STRATEGIES ===
      'volume-spike': {
        name: 'Volume Spike Strategy',
        description: 'Buys on abnormal volume spikes near support, sells at resistance',
        category: 'momentum',
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
        category: 'trend',
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
        category: 'mean-reversion',
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
        category: 'breakout',
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
        category: 'mean-reversion',
        config: {
          supportTolerance: 0.005, // 0.5% from support
          resistanceTolerance: 0.005,
          profitTarget: 0.04,
          stopLoss: 0.015,
          positionSize: 0.1
        }
      },

      // === NEW ADVANCED STRATEGIES ===
      'vwap': {
        name: 'VWAP Strategy',
        description: 'Trades mean reversion to Volume-Weighted Average Price',
        category: 'mean-reversion',
        useAdvancedStrategy: true,
        strategyClass: VWAPStrategy,
        config: {
          vwapDeviation: 0.01,
          volumeThreshold: 1.2,
          profitTarget: 0.02,
          stopLoss: 0.015,
          positionSize: 0.1
        }
      },
      'bollinger-squeeze': {
        name: 'Bollinger Squeeze',
        description: 'Trades breakouts after Bollinger Band squeeze inside Keltner Channels',
        category: 'breakout',
        useAdvancedStrategy: true,
        strategyClass: BollingerSqueezeStrategy,
        config: {
          bbPeriod: 20,
          bbStdDev: 2,
          kcPeriod: 20,
          kcAtrMultiplier: 1.5,
          profitTarget: 0.04,
          stopLoss: 0.02,
          positionSize: 0.08
        }
      },
      'rsi-divergence': {
        name: 'RSI Divergence',
        description: 'Trades RSI divergence patterns for trend reversals',
        category: 'reversal',
        useAdvancedStrategy: true,
        strategyClass: RSIDivergenceStrategy,
        config: {
          rsiPeriod: 14,
          divergenceLookback: 20,
          profitTarget: 0.035,
          stopLoss: 0.02,
          positionSize: 0.1
        }
      },
      'orb': {
        name: 'Opening Range Breakout',
        description: 'Trades breakouts from the first 30-minute opening range',
        category: 'breakout',
        useAdvancedStrategy: true,
        strategyClass: ORBStrategy,
        config: {
          openingRangeMinutes: 30,
          volumeConfirmation: 1.2,
          maxRangePercent: 0.02,
          profitTarget: 0.015,
          positionSize: 0.1
        }
      },
      'gap-fill': {
        name: 'Gap Fill Strategy',
        description: 'Fades opening gaps betting on mean reversion to previous close',
        category: 'mean-reversion',
        useAdvancedStrategy: true,
        strategyClass: GapFillStrategy,
        config: {
          minGapPercent: 0.01,
          maxGapPercent: 0.05,
          gapFillTarget: 1.0,
          stopLoss: 0.02,
          positionSize: 0.08
        }
      },

      // === AI STRATEGIES ===
      'ai-news-trader': {
        name: 'AI News Trader',
        description: 'Uses AI to analyze real-time news and make trading decisions',
        category: 'ai',
        isAI: true,
        config: {
          model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
          confidenceThreshold: 70, // Only trade with >70% confidence
          maxNewsPerHour: parseInt(process.env.AI_MAX_NEWS_PER_HOUR) || 50,
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
    const { name, botCount, strategies, watchlist, duration } = config;

    // Validate strategies
    const selectedStrategies = strategies || Object.keys(this.strategies).slice(0, botCount);
    if (selectedStrategies.length !== botCount) {
      throw new Error(`Need ${botCount} strategies for ${botCount} bots`);
    }

    const defaultWatchlist = watchlist || ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL'];

    // Insert experiment into database
    const result = await pool.query(
      `INSERT INTO experiments (id, user_id, name, bot_count, status, watchlist, duration)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [experimentId, userId, name, botCount, 'created', JSON.stringify(defaultWatchlist), duration]
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
      name: experiment.name,
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

    // Determine if this is an AI bot
    const isAIBot = strategy.isAI || false;
    const aiModel = isAIBot ? strategy.config.model : null;
    const aiConfig = isAIBot ? JSON.stringify(strategy.config) : null;

    // Insert bot into database with AI fields
    await pool.query(
      `INSERT INTO bots (id, experiment_id, user_id, strategy_key, strategy_name, config, watchlist, status, ai_enabled, ai_model, ai_config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [botId, experimentId, botUserId, strategyKey, strategy.name, JSON.stringify(strategy.config), JSON.stringify(watchlist), 'idle', isAIBot, aiModel, aiConfig]
    );

    // Insert initial metrics
    await pool.query(
      `INSERT INTO bot_metrics (bot_id, total_trades, winning_trades, losing_trades, total_profit, current_equity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [botId, 0, 0, 0, 0, 100000]
    );

    console.log(`Created bot ${botId} with ${strategy.name}${isAIBot ? ' (AI-enabled)' : ''}`);

    return {
      id: botId,
      userId: botUserId,
      strategyKey,
      strategy: strategy.name,
      config: strategy.config,
      watchlist,
      status: 'idle',
      aiEnabled: isAIBot
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

    // Start market data cache if not already started
    if (!this.cacheStarted) {
      this.marketDataCache.start();
      this.cacheStarted = true;
    }

    // Add experiment watchlist to cache (wait for initial population)
    const watchlist = experiment.watchlist;
    await this.marketDataCache.addSymbols(watchlist);

    // Allocate portfolio cash for this experiment
    await this.virtualPortfolioService.allocatePortfolioCash(experiment.user_id);

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
    // Update bot status in database and get bot info
    const result = await pool.query(
      `UPDATE bots
       SET status = $1, start_time = $2
       WHERE id = $3
       RETURNING strategy_name, ai_enabled`,
      ['running', new Date(), botId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Bot ${botId} not found`);
    }

    const strategyName = result.rows[0].strategy_name;
    const aiEnabled = result.rows[0].ai_enabled;

    if (aiEnabled) {
      // AI-enabled bot: Connect to news aggregator
      console.log(`Starting AI bot ${botId} with ${strategyName}`);

      // Get bot's watchlist to add to news aggregator
      const botResult = await pool.query(
        `SELECT watchlist FROM bots WHERE id = $1`,
        [botId]
      );
      const watchlist = botResult.rows[0]?.watchlist || [];

      // Start news aggregator if not already started
      if (!this.newsAggregatorStarted) {
        try {
          await this.newsAggregator.start();
          this.newsAggregatorStarted = true;
          console.log('📡 News Aggregator started');
        } catch (error) {
          console.error('❌ Failed to start news aggregator:', error.message);
          console.log(`⚠️  Skipping AI bot ${botId} - news aggregator unavailable`);

          // Mark bot as stopped in database
          await pool.query(
            `UPDATE bots SET status = $1, stop_time = $2 WHERE id = $3`,
            ['stopped', new Date(), botId]
          );

          return; // Skip this bot instead of failing the entire experiment
        }
      }

      // Add bot's watchlist symbols to news aggregator
      if (watchlist.length > 0) {
        this.newsAggregator.addSymbols(watchlist);
      }

      // Create news event listener for this bot
      const newsListener = async (newsArticle) => {
        try {
          // Only process if article mentions symbols in bot's watchlist
          const relevantSymbols = newsArticle.symbols.filter(s => watchlist.includes(s));
          if (relevantSymbols.length === 0 && newsArticle.symbols.length > 0) {
            return; // Skip articles not relevant to this bot's watchlist
          }

          // Check rate limit BEFORE processing (prevents queue buildup)
          if (!this.aiTradeAgent.checkRateLimit()) {
            // Silently skip - rate limited
            return;
          }

          // Pass trade executor function to AI agent
          const tradeExecutor = async (tradeParams, articleId, reasoningId) => {
            return await this.executeAITrade(botId, tradeParams, articleId, reasoningId);
          };

          await this.aiTradeAgent.processNewsForBot(botId, newsArticle, tradeExecutor);
        } catch (error) {
          console.error(`❌ Error processing news for bot ${botId}:`, error.message);
        }
      };

      // Attach listener to news aggregator
      this.newsAggregator.on('news', newsListener);
      this.newsListeners.set(botId, newsListener);

      console.log(`✅ Started AI bot ${botId} - listening for news from aggregator`);
    } else {
      // Traditional bot: Use interval-based trading
      const interval = setInterval(() => {
        this.executeBotLogic(botId);
      }, 30000); // Run every 30 seconds

      this.activeIntervals.set(botId, interval);

      console.log(`✅ Started bot ${botId} with ${strategyName}`);
    }
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
   * Delete an experiment and all associated bots
   */
  async deleteExperiment(experimentId) {
    // Get all bots for this experiment
    const botsResult = await pool.query(
      `SELECT id FROM bots WHERE experiment_id = $1`,
      [experimentId]
    );

    const botIds = botsResult.rows.map(row => row.id);

    // Stop all bots first (if running)
    for (const botId of botIds) {
      const bot = this.bots.get(botId);
      if (bot && bot.status === 'running') {
        await this.stopBot(botId);
      }
    }

    // Delete all bot trades
    await pool.query(
      `DELETE FROM bot_trades WHERE bot_id = ANY($1)`,
      [botIds]
    );

    // Delete all bots
    await pool.query(
      `DELETE FROM bots WHERE experiment_id = $1`,
      [experimentId]
    );

    // Delete experiment
    const result = await pool.query(
      `DELETE FROM experiments WHERE id = $1 RETURNING *`,
      [experimentId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    // Remove bots from memory
    for (const botId of botIds) {
      this.bots.delete(botId);
    }

    console.log(`Deleted experiment ${experimentId} and ${botIds.length} bots`);

    return { success: true, experimentId, deletedBots: botIds.length };
  }

  /**
   * Stop individual bot
   */
  async stopBot(botId) {
    // Get bot info for closing positions
    const botResult = await pool.query(
      `SELECT user_id, ai_enabled FROM bots WHERE id = $1`,
      [botId]
    );

    if (botResult.rows.length === 0) {
      throw new Error(`Bot ${botId} not found`);
    }

    const botUserId = botResult.rows[0].user_id;
    const aiEnabled = botResult.rows[0].ai_enabled;

    // Update bot status
    await pool.query(
      `UPDATE bots
       SET status = $1, stop_time = $2
       WHERE id = $3`,
      ['stopped', new Date(), botId]
    );

    if (aiEnabled) {
      // Remove news event listener for AI bot
      const newsListener = this.newsListeners.get(botId);
      if (newsListener) {
        this.newsAggregator.removeListener('news', newsListener);
        this.newsListeners.delete(botId);
        console.log(`🔇 Removed news listener for AI bot ${botId}`);
      }

      // Stop news aggregator if no more AI bots are listening
      if (this.newsListeners.size === 0 && this.newsAggregatorStarted) {
        try {
          await this.newsAggregator.stop();
          this.newsAggregatorStarted = false;
          console.log('📡 News Aggregator stopped - no active AI bots');
        } catch (error) {
          console.error('❌ Error stopping news aggregator:', error.message);
        }
      }
    } else {
      // Clear interval from memory for traditional bots
      const interval = this.activeIntervals.get(botId);
      if (interval) {
        clearInterval(interval);
        this.activeIntervals.delete(botId);
      }
    }

    // Close all positions
    await this.closeAllPositions(botId, botUserId);

    console.log(`✅ Stopped bot ${botId}`);
  }

  /**
   * Main bot trading logic - executes based on strategy
   */
  async executeBotLogic(botId) {
    try {
      // Get bot from database
      const bot = await this.getBot(botId);
      if (!bot || bot.status !== 'running') return;

      console.log(`🤖 [${bot.strategy}] Bot ${botId} analyzing market...`);

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
   * Update market data for bot's watchlist (using cache)
   */
  async updateMarketData(bot) {
    for (const symbol of bot.watchlist) {
      try {
        // Get data from cache instead of making direct API calls
        const cachedData = this.marketDataCache.getCachedData(symbol);

        if (!cachedData) {
          console.warn(`No cached data for ${symbol}, skipping update`);
          continue;
        }

        const quote = cachedData.quote;
        const bars = cachedData.bars;

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

        // Get current price - try multiple sources
        let currentPrice = null;
        if (quote) {
          // Alpaca uses capitalized property names
          currentPrice = quote.AskPrice || quote.BidPrice || quote.ap || quote.bp || quote.p;
          if (!currentPrice) {
            console.warn(`   [${bot.strategy}] ${symbol}: Quote has no price. AskPrice=${quote.AskPrice}, BidPrice=${quote.BidPrice}`);
          }
        }

        // Fallback to latest bar close price if quote doesn't have price
        if (!currentPrice && bars && bars.length > 0) {
          const latestBar = bars[bars.length - 1];
          currentPrice = latestBar.ClosePrice || latestBar.c;
          if (!currentPrice) {
            console.warn(`   [${bot.strategy}] ${symbol}: Bar has no price. ClosePrice=${latestBar.ClosePrice}, c=${latestBar.c}`);
            console.warn(`   Bar keys: ${JSON.stringify(Object.keys(latestBar))}`);
          } else {
            console.log(`   [${bot.strategy}] ${symbol}: Using bar price $${currentPrice}`);
          }
        }

        if (!currentPrice) {
          console.warn(`   [${bot.strategy}] ${symbol}: No price data available in quote or bars`);
          continue;
        }

        // Add new price
        prices.push(currentPrice);
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
        // Get quote from cache
        const quote = this.marketDataCache.getQuote(symbol);
        if (!quote) {
          console.warn(`No cached quote for ${symbol}, skipping exit check`);
          continue;
        }
        const currentPrice = quote.AskPrice || quote.BidPrice || quote.ap || quote.bp || quote.p;
        if (!currentPrice) {
          console.warn(`No price for ${symbol}, skipping exit check`);
          continue;
        }
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
        // Get quote from cache
        const quote = this.marketDataCache.getQuote(symbol);
        if (!quote) {
          console.warn(`No cached quote for ${symbol}, skipping entry check`);
          continue;
        }
        const currentPrice = quote.AskPrice || quote.BidPrice || quote.ap || quote.bp || quote.p;
        if (!currentPrice) {
          console.warn(`No price for ${symbol}, skipping entry check`);
          continue;
        }

        // Get price and volume history from database
        const historyResult = await pool.query(
          `SELECT prices, volumes FROM price_history WHERE bot_id = $1 AND symbol = $2`,
          [bot.id, symbol]
        );

        const priceHistory = historyResult.rows.length > 0 ? historyResult.rows[0].prices : [];
        const volumeHistory = historyResult.rows.length > 0 ? historyResult.rows[0].volumes : [];

        if (priceHistory.length < 20) {
          console.log(`   [${bot.strategy}] ${symbol}: Need more history (${priceHistory.length}/20)`);
          continue; // Need enough history
        }

        let shouldBuy = false;
        let reason = '';

        // Check if this is an advanced strategy with a strategy class
        const strategyDef = this.strategies[bot.strategyKey];
        if (strategyDef && strategyDef.useAdvancedStrategy && strategyDef.strategyClass) {
          // Use the advanced strategy class
          const avgVolume = volumeHistory.length > 0
            ? volumeHistory.reduce((a, b) => a + b, 0) / volumeHistory.length
            : 1000000;

          const strategyInstance = new strategyDef.strategyClass(bot.config);
          const signal = strategyInstance.checkEntry(priceHistory, volumeHistory, currentPrice, avgVolume);

          if (signal.shouldEnter) {
            shouldBuy = true;
            reason = signal.reason;
            console.log(`   [${bot.strategy}] ${symbol}: ${reason} (confidence: ${signal.confidence}%)`);
          }
        } else {
          // Original strategy logic
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
              const avgVolumeBreakout = volumeHistory.reduce((a, b) => a + b, 0) / volumeHistory.length;
              const currentVolumeBreakout = volumeHistory[volumeHistory.length - 1];
              if (currentPrice > resistance * (1 + bot.config.breakoutThreshold) &&
                  currentVolumeBreakout > avgVolumeBreakout * bot.config.volumeConfirmation) {
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

      const tradeValue = qty * currentPrice;

      // Check if experiment has enough allocated cash
      const canTrade = await this.virtualPortfolioService.canExperimentTrade(bot.experimentId, tradeValue);

      if (!canTrade) {
        console.warn(`Bot ${bot.id} cannot buy ${symbol} - experiment ${bot.experimentId} allocation exceeded`);
        return;
      }

      // Place order via virtual portfolio
      const order = await this.virtualPortfolioService.placeOrder(bot.userId, {
        symbol,
        qty,
        side: 'buy',
        type: 'market'
      });

      // Update experiment used cash
      await this.virtualPortfolioService.updateExperimentUsedCash(bot.experimentId, tradeValue, 'buy');

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
        orderId: order.id,
        bot_id: bot.id,
        bot_strategy: bot.strategy
      };

      console.log(`Bot ${bot.id} BUY: ${qty} ${symbol} @ $${currentPrice.toFixed(2)} - ${reason}`);
      this.emit('botTrade', { botId: bot.id, trade });

      // Emit WebSocket event for real-time updates
      if (this.io) {
        this.io.emit('newTrade', {
          experimentId: bot.experimentId,
          trade
        });
      }

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

      // Get quote from cache
      const quote = this.marketDataCache.getQuote(symbol);
      if (!quote) {
        console.error(`No cached quote for ${symbol}, cannot record sell price`);
        return;
      }

      const sellPrice = quote.AskPrice || quote.BidPrice || quote.ap || quote.bp || quote.p || order.filled_avg_price || position.current_price;
      const tradeValue = qty * sellPrice;

      // Update experiment used cash (decrease on sell)
      await this.virtualPortfolioService.updateExperimentUsedCash(bot.experimentId, tradeValue, 'sell');

      // Store trade in database
      await pool.query(
        `INSERT INTO bot_trades (bot_id, time, symbol, side, qty, price, reason, order_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [bot.id, new Date(), symbol, 'sell', qty, sellPrice, reason, order.id]
      );

      const trade = {
        time: new Date(),
        symbol,
        side: 'sell',
        qty,
        price: sellPrice,
        reason,
        orderId: order.id,
        bot_id: bot.id,
        bot_strategy: bot.strategy
      };

      console.log(`Bot ${bot.id} SELL: ${qty} ${symbol} @ $${sellPrice.toFixed(2)} - ${reason}`);
      this.emit('botTrade', { botId: bot.id, trade });

      // Emit WebSocket event for real-time updates
      if (this.io) {
        this.io.emit('newTrade', {
          experimentId: bot.experimentId,
          trade
        });
      }

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
   * Execute AI-generated trade
   * Called by AI Trade Agent when it decides to make a trade
   */
  async executeAITrade(botId, tradeParams, articleId, reasoningId) {
    try {
      // Get bot info
      const botResult = await pool.query(
        `SELECT user_id, watchlist FROM bots WHERE id = $1`,
        [botId]
      );

      if (botResult.rows.length === 0) {
        throw new Error(`Bot ${botId} not found`);
      }

      const { user_id: userId, watchlist } = botResult.rows[0];
      const { symbol, side, qty, profitTarget, stopLoss } = tradeParams;

      // Validate symbol is in watchlist
      if (!watchlist.includes(symbol)) {
        throw new Error(`Symbol ${symbol} not in bot's watchlist`);
      }

      // Place order via virtual portfolio
      const order = await this.virtualPortfolioService.placeOrder(userId, {
        symbol,
        qty,
        side: side.toLowerCase(),
        type: 'market'
      });

      // Get current price from cache
      const quote = this.marketDataCache.getQuote(symbol);
      if (!quote) {
        throw new Error(`No cached quote for ${symbol}`);
      }
      const executionPrice = side === 'BUY' ? quote.AskPrice : quote.BidPrice;

      // Record trade in database with AI metadata
      const tradeRecord = {
        bot_id: botId,
        symbol,
        side: side.toLowerCase(),
        qty,
        price: executionPrice,
        time: new Date(),
        order_id: order.id,
        news_article_id: articleId,
        ai_reasoning_id: reasoningId,
        profit_target: profitTarget,
        stop_loss: stopLoss
      };

      await pool.query(
        `INSERT INTO bot_trades
         (bot_id, symbol, side, qty, price, time, order_id, news_article_id, ai_reasoning_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          tradeRecord.bot_id,
          tradeRecord.symbol,
          tradeRecord.side,
          tradeRecord.qty,
          tradeRecord.price,
          tradeRecord.time,
          tradeRecord.order_id,
          tradeRecord.news_article_id,
          tradeRecord.ai_reasoning_id
        ]
      );

      console.log(`🤖 AI Bot ${botId} ${side}: ${qty} ${symbol} @ $${executionPrice.toFixed(2)}`);
      console.log(`   Profit Target: $${profitTarget.toFixed(2)} | Stop Loss: $${stopLoss.toFixed(2)}`);

      this.emit('botTrade', { botId, trade: tradeRecord });

      return {
        success: true,
        message: `Trade executed: ${side} ${qty} ${symbol} @ $${executionPrice.toFixed(2)}`,
        tradeId: order.id,
        executionPrice
      };

    } catch (error) {
      console.error(`❌ AI trade execution failed for bot ${botId}:`, error.message);
      return {
        success: false,
        error: error.message
      };
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
      name: exp.name,
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
        name: exp.name,
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
