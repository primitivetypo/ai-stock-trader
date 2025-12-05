const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');
const { experimentLimiter } = require('../middleware/rateLimiter');

// Get available strategies
router.get('/strategies', authenticateToken, (req, res) => {
  try {
    const tradingBotService = req.app.locals.tradingBotService;
    const strategies = tradingBotService.getStrategies();

    res.json(strategies);
  } catch (error) {
    console.error('Failed to get strategies:', error);
    res.status(500).json({ error: 'Failed to fetch strategies' });
  }
});

// Create new experiment
router.post('/create', authenticateToken, experimentLimiter, async (req, res) => {
  try {
    const tradingBotService = req.app.locals.tradingBotService;
    const { name, botCount, strategies, watchlist, duration, marketplaceStrategyId } = req.body;

    if (!botCount || botCount < 1 || botCount > 10) {
      return res.status(400).json({ error: 'Bot count must be between 1 and 10' });
    }

    const experiment = await tradingBotService.createExperiment(req.user.userId, {
      name,
      botCount,
      strategies,
      watchlist,
      duration,
      marketplaceStrategyId
    });

    res.json(experiment);
  } catch (error) {
    console.error('Failed to create experiment:', error);
    res.status(500).json({ error: error.message || 'Failed to create experiment' });
  }
});

// Start experiment
router.post('/:experimentId/start', authenticateToken, async (req, res) => {
  try {
    const tradingBotService = req.app.locals.tradingBotService;
    const { experimentId } = req.params;

    const experiment = await tradingBotService.getExperiment(experimentId);
    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    if (experiment.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const startedExperiment = await tradingBotService.startExperiment(experimentId);
    res.json(startedExperiment);
  } catch (error) {
    console.error('Failed to start experiment:', error);
    res.status(500).json({ error: error.message || 'Failed to start experiment' });
  }
});

// Stop experiment
router.post('/:experimentId/stop', authenticateToken, async (req, res) => {
  try {
    const tradingBotService = req.app.locals.tradingBotService;
    const { experimentId } = req.params;

    const experiment = await tradingBotService.getExperiment(experimentId);
    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    if (experiment.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const stoppedExperiment = await tradingBotService.stopExperiment(experimentId);
    res.json(stoppedExperiment);
  } catch (error) {
    console.error('Failed to stop experiment:', error);
    res.status(500).json({ error: error.message || 'Failed to stop experiment' });
  }
});

// Get all trades for an experiment
router.get('/:experimentId/trades', authenticateToken, async (req, res) => {
  try {
    const tradingBotService = req.app.locals.tradingBotService;
    const { experimentId } = req.params;

    const experiment = await tradingBotService.getExperiment(experimentId);
    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    if (experiment.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Fetch all trades from all bots in the experiment
    const pool = require('../db/database');
    const tradesResult = await pool.query(
      `SELECT bt.*, b.strategy_name as bot_strategy, b.id as bot_id
       FROM bot_trades bt
       JOIN bots b ON bt.bot_id = b.id
       WHERE b.id = ANY($1)
       ORDER BY bt.time DESC`,
      [experiment.bots]
    );

    res.json({
      experimentId,
      trades: tradesResult.rows
    });
  } catch (error) {
    console.error('Failed to get experiment trades:', error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// Get experiment details
router.get('/:experimentId', authenticateToken, async (req, res) => {
  try {
    const tradingBotService = req.app.locals.tradingBotService;
    const { experimentId } = req.params;

    const experiment = await tradingBotService.getExperiment(experimentId);
    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    if (experiment.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get bot details
    const botsWithDetails = await Promise.all(experiment.bots.map(async botId => {
      const bot = await tradingBotService.getBot(botId);
      return {
        id: bot.id,
        strategy: bot.strategy,
        status: bot.status,
        metrics: bot.metrics,
        trades: bot.trades
      };
    }));

    res.json({
      ...experiment,
      botsDetails: botsWithDetails
    });
  } catch (error) {
    console.error('Failed to get experiment:', error);
    res.status(500).json({ error: 'Failed to fetch experiment' });
  }
});

// Get all experiments for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const tradingBotService = req.app.locals.tradingBotService;
    const experiments = await tradingBotService.getUserExperiments(req.user.userId);

    // Add summary for each experiment
    const experimentsWithSummary = await Promise.all(experiments.map(async exp => {
      const bots = await Promise.all(exp.bots.map(async botId => {
        try {
          const bot = await tradingBotService.getBot(botId);
          if (!bot) {
            // Bot not in memory, fetch from database
            const pool = require('../db/database');
            const botResult = await pool.query('SELECT * FROM bots WHERE id = $1', [botId]);
            if (botResult.rows.length > 0) {
              const dbBot = botResult.rows[0];
              return {
                id: dbBot.id,
                strategy: dbBot.strategy,
                status: dbBot.status,
                currentEquity: dbBot.metrics?.currentEquity || 100000,
                totalProfit: dbBot.metrics?.totalProfit || 0
              };
            }
          }
          return {
            id: bot.id,
            strategy: bot.strategy,
            status: bot.status,
            currentEquity: bot.metrics.currentEquity,
            totalProfit: bot.metrics.totalProfit
          };
        } catch (error) {
          console.error(`Failed to load bot ${botId}:`, error);
          return {
            id: botId,
            strategy: 'Unknown',
            status: 'error',
            currentEquity: 0,
            totalProfit: 0
          };
        }
      }));

      return {
        ...exp,
        bots
      };
    }));

    res.json(experimentsWithSummary);
  } catch (error) {
    console.error('Failed to get experiments:', error);
    res.status(500).json({ error: 'Failed to fetch experiments' });
  }
});

// Get bot details
router.get('/bot/:botId', authenticateToken, async (req, res) => {
  try {
    const tradingBotService = req.app.locals.tradingBotService;
    const { botId } = req.params;

    const bot = await tradingBotService.getBot(botId);
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Verify ownership through experiment
    const experiments = await tradingBotService.getUserExperiments(req.user.userId);
    const authorized = experiments.some(exp => exp.bots.includes(botId));

    if (!authorized) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({
      id: bot.id,
      strategy: bot.strategy,
      strategyKey: bot.strategyKey,
      status: bot.status,
      config: bot.config,
      watchlist: bot.watchlist,
      metrics: bot.metrics,
      trades: bot.trades,
      startTime: bot.startTime,
      stopTime: bot.stopTime
    });
  } catch (error) {
    console.error('Failed to get bot:', error);
    res.status(500).json({ error: 'Failed to fetch bot' });
  }
});

// Get experiment results/comparison
router.get('/:experimentId/results', authenticateToken, async (req, res) => {
  try {
    const tradingBotService = req.app.locals.tradingBotService;
    const { experimentId } = req.params;

    const experiment = await tradingBotService.getExperiment(experimentId);
    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    if (experiment.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Calculate current results
    const results = await tradingBotService.calculateExperimentResults(experimentId);

    res.json({
      experimentId,
      status: experiment.status,
      startTime: experiment.startTime,
      endTime: experiment.endTime,
      results
    });
  } catch (error) {
    console.error('Failed to get experiment results:', error);
    res.status(500).json({ error: 'Failed to fetch experiment results' });
  }
});

// Delete experiment
router.delete('/:experimentId', authenticateToken, async (req, res) => {
  try {
    const tradingBotService = req.app.locals.tradingBotService;
    const { experimentId } = req.params;

    const experiment = await tradingBotService.getExperiment(experimentId);
    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    if (experiment.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Stop experiment if running
    if (experiment.status === 'running') {
      await tradingBotService.stopExperiment(experimentId);
    }

    // Delete experiment
    await tradingBotService.deleteExperiment(experimentId);

    res.json({ success: true, message: 'Experiment deleted successfully' });
  } catch (error) {
    console.error('Failed to delete experiment:', error);
    res.status(500).json({ error: error.message || 'Failed to delete experiment' });
  }
});

module.exports = router;
