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
router.get('/levels/:symbol', authenticateToken, async (req, res) => {
  try {
    const volumeEngine = req.app.locals.volumeEngine;
    const alpacaService = req.app.locals.alpacaService;
    const symbol = req.params.symbol.toUpperCase();

    console.log(`📊 [Market API] Fetching levels for ${symbol}...`);
    const levels = volumeEngine.getSupportResistance(symbol);

    // If no levels from volume engine, fetch current price and return empty levels
    if (!levels) {
      let currentPrice = 0;

      try {
        // Try to get snapshot first
        const snapshots = await alpacaService.getSnapshots([symbol]);
        const snapshot = snapshots[symbol];

        if (snapshot) {
          // Try different price sources in order of preference
          if (snapshot.dailyBar?.c) {
            currentPrice = snapshot.dailyBar.c;
          } else if (snapshot.latestTrade?.p) {
            currentPrice = snapshot.latestTrade.p;
          } else if (snapshot.prevDailyBar?.c) {
            currentPrice = snapshot.prevDailyBar.c;
          } else if (snapshot.latestQuote?.ap) {
            currentPrice = snapshot.latestQuote.ap;
          } else if (snapshot.latestQuote?.bp) {
            currentPrice = snapshot.latestQuote.bp;
          }
        }
      } catch (snapshotError) {
        console.log(`Snapshot failed for ${symbol}:`, snapshotError.message);
      }

      // If no price from snapshot, try getting latest bar
      if (currentPrice === 0) {
        try {
          const bars = await alpacaService.getBars(symbol, {
            timeframe: '1Day',
            limit: 1
          });

          if (bars && bars.length > 0) {
            currentPrice = bars[0].ClosePrice || bars[0].c;
          }
        } catch (barsError) {
          console.log(`Failed to get bars for ${symbol}`);
        }
      }


      console.log(`💰 [Market API] ${symbol} price from snapshot/bars: $${currentPrice}`);
      return res.json({
        symbol: symbol,
        currentPrice: currentPrice,
        support: [],
        resistance: [],
        updatedAt: new Date().toISOString(),
        message: 'No data available - volume engine not active'
      });
    }

    console.log(`✅ [Market API] ${symbol} levels:`, {
      price: levels.currentPrice,
      support: levels.support.length,
      resistance: levels.resistance.length
    });
    res.json(levels);
  } catch (error) {
    console.error('Failed to get support/resistance:', error);
    res.status(500).json({ error: 'Failed to fetch support/resistance levels' });
  }
});

// Search stocks by symbol or company name
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const alpacaService = req.app.locals.alpacaService;
    const { q, limit = 20 } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({ error: 'Search query required' });
    }

    const results = await alpacaService.searchAssets(q.trim(), parseInt(limit));

    res.json(results);
  } catch (error) {
    console.error('Failed to search stocks:', error);
    res.status(500).json({ error: 'Failed to search stocks' });
  }
});

// Get all tradable US stocks
router.get('/assets', authenticateToken, async (req, res) => {
  try {
    const alpacaService = req.app.locals.alpacaService;
    const assets = await alpacaService.getAllAssets();

    res.json(assets);
  } catch (error) {
    console.error('Failed to get assets:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// Get logo for a stock symbol
router.get('/logo/:symbol', authenticateToken, async (req, res) => {
  try {
    const alpacaService = req.app.locals.alpacaService;
    const { symbol } = req.params;

    const logo = await alpacaService.getLogo(symbol);

    res.json(logo);
  } catch (error) {
    console.error('Failed to get logo:', error);
    res.status(404).json({ error: 'Logo not found' });
  }
});

module.exports = router;
