const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');

// Get quote
router.get('/quote/:symbol', authenticateToken, async (req, res) => {
  try {
    const alpacaService = req.app.locals.alpacaService;
    const quote = await alpacaService.getQuote(req.params.symbol);

    res.json(quote);
  } catch (error) {
    console.error('Failed to get quote:', error);
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

// Get bars
router.get('/bars/:symbol', authenticateToken, async (req, res) => {
  try {
    const alpacaService = req.app.locals.alpacaService;
    const { timeframe = '1Min', limit = 100 } = req.query;

    const bars = await alpacaService.getBars(req.params.symbol, {
      timeframe,
      limit: parseInt(limit)
    });

    res.json(bars);
  } catch (error) {
    console.error('Failed to get bars:', error);
    res.status(500).json({ error: 'Failed to fetch bars' });
  }
});

// Get snapshots
router.post('/snapshots', authenticateToken, async (req, res) => {
  try {
    const alpacaService = req.app.locals.alpacaService;
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ error: 'Symbols array required' });
    }

    const snapshots = await alpacaService.getSnapshots(symbols);

    res.json(snapshots);
  } catch (error) {
    console.error('Failed to get snapshots:', error);
    res.status(500).json({ error: 'Failed to fetch snapshots' });
  }
});

// Get watchlist
router.get('/watchlist', authenticateToken, (req, res) => {
  try {
    const volumeEngine = req.app.locals.volumeEngine;
    const watchlist = volumeEngine.getWatchlist();

    res.json(watchlist);
  } catch (error) {
    console.error('Failed to get watchlist:', error);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

// Add to watchlist
router.post('/watchlist', authenticateToken, (req, res) => {
  try {
    const volumeEngine = req.app.locals.volumeEngine;
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol required' });
    }

    volumeEngine.addToWatchlist(symbol.toUpperCase());

    res.json({ success: true, watchlist: volumeEngine.getWatchlist() });
  } catch (error) {
    console.error('Failed to add to watchlist:', error);
    res.status(500).json({ error: 'Failed to add to watchlist' });
  }
});

// Remove from watchlist
router.delete('/watchlist/:symbol', authenticateToken, (req, res) => {
  try {
    const volumeEngine = req.app.locals.volumeEngine;
    volumeEngine.removeFromWatchlist(req.params.symbol.toUpperCase());

    res.json({ success: true, watchlist: volumeEngine.getWatchlist() });
  } catch (error) {
    console.error('Failed to remove from watchlist:', error);
    res.status(500).json({ error: 'Failed to remove from watchlist' });
  }
});

// Get support/resistance levels
router.get('/levels/:symbol', authenticateToken, (req, res) => {
  try {
    const volumeEngine = req.app.locals.volumeEngine;
    const levels = volumeEngine.getSupportResistance(req.params.symbol.toUpperCase());

    if (!levels) {
      return res.status(404).json({ error: 'No data available for symbol' });
    }

    res.json(levels);
  } catch (error) {
    console.error('Failed to get support/resistance:', error);
    res.status(500).json({ error: 'Failed to fetch support/resistance levels' });
  }
});

module.exports = router;
