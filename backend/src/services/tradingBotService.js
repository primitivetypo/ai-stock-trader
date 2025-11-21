const EventEmitter = require('events');

/**
 * Trading Bot Service
 * Manages autonomous trading bots that run experiments with different strategies
 */
class TradingBotService extends EventEmitter {
  constructor(virtualPortfolioService, alpacaService) {
    super();
    this.virtualPortfolioService = virtualPortfolioService;
    this.alpacaService = alpacaService;
    this.experiments = new Map(); // experimentId -> experiment data
    this.bots = new Map(); // botId -> bot instance
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

    const experiment = {
      id: experimentId,
      userId,
      botCount,
      startTime: new Date(),
      endTime: duration ? new Date(Date.now() + duration) : null,
      status: 'created',
      bots: [],
      watchlist: watchlist || ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL'],
      results: []
    };

    // Create bots for this experiment
    for (let i = 0; i < botCount; i++) {
      const strategyKey = selectedStrategies[i];
      const botId = `${experimentId}-bot-${i + 1}`;

      const bot = await this.createBot(botId, userId, strategyKey, experiment.watchlist);
      experiment.bots.push(bot.id);
    }

    this.experiments.set(experimentId, experiment);
    console.log(`Created experiment ${experimentId} with ${botCount} bots`);

    return experiment;
  }

  /**
   * Create individual bot with strategy
   */
  async createBot(botId, userId, strategyKey, watchlist) {
    const strategy = this.strategies[strategyKey];
    if (!strategy) {
      throw new Error(`Unknown strategy: ${strategyKey}`);
    }

    // Create virtual portfolio for this bot
    const botUserId = `${userId}-${botId}`;
    await this.virtualPortfolioService.createPortfolio(botUserId);

    const bot = {
      id: botId,
      userId: botUserId,
      strategyKey,
      strategy: strategy.name,
      config: { ...strategy.config },
      watchlist,
      status: 'idle',
      startTime: null,
      stopTime: null,
      trades: [],
      metrics: {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        totalProfit: 0,
        currentEquity: 100000
      },
      positions: new Map(),
      priceHistory: new Map(), // symbol -> price array
      volumeHistory: new Map() // symbol -> volume array
    };

    this.bots.set(botId, bot);
    console.log(`Created bot ${botId} with ${strategy.name}`);

    return bot;
  }

  /**
   * Start an experiment (all bots start trading)
   */
  async startExperiment(experimentId) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    experiment.status = 'running';
    experiment.startTime = new Date();

    // Start all bots
    for (const botId of experiment.bots) {
      await this.startBot(botId);
    }

    console.log(`Started experiment ${experimentId}`);
    this.emit('experimentStarted', experiment);

    return experiment;
  }

  /**
   * Start individual bot
   */
  async startBot(botId) {
    const bot = this.bots.get(botId);
    if (!bot) {
      throw new Error(`Bot ${botId} not found`);
    }

    bot.status = 'running';
    bot.startTime = new Date();

    // Start bot trading loop
    bot.interval = setInterval(() => {
      this.executeBotLogic(botId);
    }, 30000); // Run every 30 seconds

    console.log(`Started bot ${botId} with ${bot.strategy}`);
  }

  /**
   * Stop an experiment
   */
  async stopExperiment(experimentId) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    experiment.status = 'stopped';
    experiment.endTime = new Date();

    // Stop all bots
    for (const botId of experiment.bots) {
      await this.stopBot(botId);
    }

    // Calculate final results
    experiment.results = await this.calculateExperimentResults(experimentId);

    console.log(`Stopped experiment ${experimentId}`);
    this.emit('experimentStopped', experiment);

    return experiment;
  }

  /**
   * Stop individual bot
   */
  async stopBot(botId) {
    const bot = this.bots.get(botId);
    if (!bot) {
      throw new Error(`Bot ${botId} not found`);
    }

    bot.status = 'stopped';
    bot.stopTime = new Date();

    // Clear interval
    if (bot.interval) {
      clearInterval(bot.interval);
      bot.interval = null;
    }

    // Close all positions
    await this.closeAllPositions(botId);

    console.log(`Stopped bot ${botId}`);
  }

  /**
   * Main bot trading logic - executes based on strategy
   */
  async executeBotLogic(botId) {
    const bot = this.bots.get(botId);
    if (!bot || bot.status !== 'running') return;

    try {
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

        // Store price history
        if (!bot.priceHistory.has(symbol)) {
          bot.priceHistory.set(symbol, []);
        }
        bot.priceHistory.get(symbol).push(quote.ap);
        if (bot.priceHistory.get(symbol).length > 100) {
          bot.priceHistory.get(symbol).shift();
        }

        // Store volume history
        if (!bot.volumeHistory.has(symbol)) {
          bot.volumeHistory.set(symbol, []);
        }
        if (bars.length > 0) {
          bot.volumeHistory.get(symbol).push(bars[bars.length - 1].v);
          if (bot.volumeHistory.get(symbol).length > 100) {
            bot.volumeHistory.get(symbol).shift();
          }
        }
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
            const rsi = this.calculateRSI(bot.priceHistory.get(symbol), bot.config.rsiPeriod);
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
            const resistance = await this.calculateResistance(symbol, bot.priceHistory.get(symbol));
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
        const priceHistory = bot.priceHistory.get(symbol) || [];
        const volumeHistory = bot.volumeHistory.get(symbol) || [];

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

      bot.trades.push({
        time: new Date(),
        symbol,
        side: 'buy',
        qty,
        price: currentPrice,
        reason,
        orderId: order.id
      });

      console.log(`Bot ${bot.id} BUY: ${qty} ${symbol} @ $${currentPrice.toFixed(2)} - ${reason}`);
      this.emit('botTrade', { botId: bot.id, trade: bot.trades[bot.trades.length - 1] });

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
      bot.trades.push({
        time: new Date(),
        symbol,
        side: 'sell',
        qty,
        price: quote.ap,
        reason,
        orderId: order.id
      });

      console.log(`Bot ${bot.id} SELL: ${qty} ${symbol} @ $${quote.ap.toFixed(2)} - ${reason}`);
      this.emit('botTrade', { botId: bot.id, trade: bot.trades[bot.trades.length - 1] });

    } catch (error) {
      console.error(`Bot ${bot.id} failed to sell ${position.symbol}:`, error.message);
    }
  }

  /**
   * Close all positions for a bot
   */
  async closeAllPositions(botId) {
    const bot = this.bots.get(botId);
    const positions = await this.virtualPortfolioService.getPositions(bot.userId);

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
      bot.metrics.currentEquity = parseFloat(account.equity);
      bot.metrics.totalProfit = bot.metrics.currentEquity - 100000;

      // Count wins/losses
      let wins = 0;
      let losses = 0;
      const buyTrades = bot.trades.filter(t => t.side === 'buy');
      const sellTrades = bot.trades.filter(t => t.side === 'sell');

      for (const sell of sellTrades) {
        const buy = buyTrades.find(b => b.symbol === sell.symbol && b.time < sell.time);
        if (buy) {
          const profit = (sell.price - buy.price) * sell.qty;
          if (profit > 0) wins++;
          else if (profit < 0) losses++;
        }
      }

      bot.metrics.totalTrades = wins + losses;
      bot.metrics.winningTrades = wins;
      bot.metrics.losingTrades = losses;

    } catch (error) {
      console.error(`Failed to update metrics for bot ${bot.id}:`, error.message);
    }
  }

  /**
   * Calculate experiment results
   */
  async calculateExperimentResults(experimentId) {
    const experiment = this.experiments.get(experimentId);
    const results = [];

    for (const botId of experiment.bots) {
      const bot = this.bots.get(botId);
      await this.updateBotMetrics(bot);

      results.push({
        botId: bot.id,
        strategy: bot.strategy,
        finalEquity: bot.metrics.currentEquity,
        totalProfit: bot.metrics.totalProfit,
        returnPercent: ((bot.metrics.currentEquity - 100000) / 100000) * 100,
        totalTrades: bot.metrics.totalTrades,
        winningTrades: bot.metrics.winningTrades,
        losingTrades: bot.metrics.losingTrades,
        winRate: bot.metrics.totalTrades > 0
          ? (bot.metrics.winningTrades / bot.metrics.totalTrades) * 100
          : 0
      });
    }

    // Sort by profit
    results.sort((a, b) => b.totalProfit - a.totalProfit);

    return results;
  }

  /**
   * Get experiment details
   */
  getExperiment(experimentId) {
    return this.experiments.get(experimentId);
  }

  /**
   * Get all experiments for a user
   */
  getUserExperiments(userId) {
    const userExperiments = [];
    for (const [id, exp] of this.experiments.entries()) {
      if (exp.userId === userId) {
        userExperiments.push(exp);
      }
    }
    return userExperiments;
  }

  /**
   * Get bot details
   */
  getBot(botId) {
    return this.bots.get(botId);
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
