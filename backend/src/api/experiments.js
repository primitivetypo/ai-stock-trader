const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');

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
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const tradingBotService = req.app.locals.tradingBotService;
    const { botCount, strategies, watchlist, duration } = req.body;

    if (!botCount || botCount < 1 || botCount > 10) {
      return res.status(400).json({ error: 'Bot count must be between 1 and 10' });
    }

    const experiment = await tradingBotService.createExperiment(req.user.userId, {
      botCount,
      strategies,
      watchlist,
      duration
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
        const bot = await tradingBotService.getBot(botId);
        return {
          id: bot.id,
          strategy: bot.strategy,
          status: bot.status,
          currentEquity: bot.metrics.currentEquity,
          totalProfit: bot.metrics.totalProfit
        };
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

module.exports = router;
