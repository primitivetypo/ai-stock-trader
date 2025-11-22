const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');

// Get performance metrics
router.get('/performance', authenticateToken, async (req, res) => {
  try {
    const virtualPortfolioService = req.app.locals.virtualPortfolioService;
    const paperInvestService = req.app.locals.paperInvestService;

    const account = await virtualPortfolioService.getAccount(req.user.userId);
    const positions = await virtualPortfolioService.getPositions(req.user.userId);
    const orders = await virtualPortfolioService.getOrders(req.user.userId, 'all');

    // Calculate metrics
    const equity = parseFloat(account.equity);
    const initialEquity = 100000; // Starting virtual money
    const totalReturn = ((equity - initialEquity) / initialEquity) * 100;

    const openOrders = orders.filter(o => o.status === 'open' || o.status === 'pending');
    const filledOrders = orders.filter(o => o.status === 'filled');

    // Get simulation metrics
    const simulationMetrics = await paperInvestService.getSimulationMetrics();

    res.json({
      account: {
        equity: parseFloat(account.equity),
        cash: parseFloat(account.cash),
        buyingPower: parseFloat(account.buying_power),
        portfolioValue: parseFloat(account.portfolio_value)
      },
      performance: {
        totalReturn,
        totalReturnPercent: totalReturn,
        dayReturn: parseFloat(account.equity) - parseFloat(account.last_equity),
        dayReturnPercent: ((parseFloat(account.equity) - parseFloat(account.last_equity)) / parseFloat(account.last_equity)) * 100
      },
      positions: {
        count: positions.length,
        totalValue: positions.reduce((sum, p) => sum + parseFloat(p.market_value || 0), 0)
      },
      orders: {
        total: orders.length,
        open: openOrders.length,
        filled: filledOrders.length
      },
      simulation: simulationMetrics
    });
  } catch (error) {
    console.error('Failed to get performance metrics:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

// Get trading history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const virtualPortfolioService = req.app.locals.virtualPortfolioService;
    const { limit = 50 } = req.query;

    const orders = await virtualPortfolioService.getOrders(req.user.userId, 'closed');

    // Sort by date and limit
    const history = orders
      .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
      .slice(0, parseInt(limit));

    res.json(history);
  } catch (error) {
    console.error('Failed to get trading history:', error);
    res.status(500).json({ error: 'Failed to fetch trading history' });
  }
});

// Get win rate and statistics
router.get('/statistics', authenticateToken, async (req, res) => {
  try {
    const virtualPortfolioService = req.app.locals.virtualPortfolioService;
    const orders = await virtualPortfolioService.getOrders(req.user.userId, 'closed');

    const filledOrders = orders.filter(o => o.status === 'filled');

    // Calculate statistics
    let wins = 0;
    let losses = 0;
    let totalProfit = 0;

    // Group by symbol to calculate P&L
    const symbolTrades = new Map();

    filledOrders.forEach(order => {
      if (!symbolTrades.has(order.symbol)) {
        symbolTrades.set(order.symbol, []);
      }
      symbolTrades.get(order.symbol).push(order);
    });

    symbolTrades.forEach(trades => {
      let position = 0;
      let avgCost = 0;

      trades.forEach(trade => {
        const qty = parseInt(trade.filled_qty || trade.qty);
        const price = parseFloat(trade.filled_avg_price || trade.price);

        if (trade.side === 'buy') {
          avgCost = ((avgCost * position) + (price * qty)) / (position + qty);
          position += qty;
        } else if (trade.side === 'sell') {
          const profit = (price - avgCost) * qty;
          totalProfit += profit;

          if (profit > 0) wins++;
          else if (profit < 0) losses++;

          position -= qty;
        }
      });
    });

    const totalTrades = wins + losses;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    res.json({
      totalTrades,
      wins,
      losses,
      winRate,
      totalProfit,
      avgProfitPerTrade: totalTrades > 0 ? totalProfit / totalTrades : 0
    });
  } catch (error) {
    console.error('Failed to get statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
