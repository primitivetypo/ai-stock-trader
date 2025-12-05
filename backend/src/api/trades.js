const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');

// Get all orders
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    const virtualPortfolioService = req.app.locals.virtualPortfolioService;

    const orders = await virtualPortfolioService.getOrders(req.user.userId, status);

    res.json(orders);
  } catch (error) {
    console.error('Failed to get orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Place order
router.post('/orders', authenticateToken, async (req, res) => {
  try {
    const virtualPortfolioService = req.app.locals.virtualPortfolioService;

    const order = await virtualPortfolioService.placeOrder(req.user.userId, req.body);

    res.json(order);
  } catch (error) {
    console.error('Failed to place order:', error);
    res.status(500).json({ error: error.message || 'Failed to place order' });
  }
});

// Cancel order
router.delete('/orders/:orderId', authenticateToken, async (req, res) => {
  try {
    const virtualPortfolioService = req.app.locals.virtualPortfolioService;
    const order = await virtualPortfolioService.cancelOrder(req.user.userId, req.params.orderId);

    res.json(order);
  } catch (error) {
    console.error('Failed to cancel order:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

// Get positions
router.get('/positions', authenticateToken, async (req, res) => {
  try {
    const virtualPortfolioService = req.app.locals.virtualPortfolioService;
    const positions = await virtualPortfolioService.getPositions(req.user.userId);

    res.json(positions);
  } catch (error) {
    console.error('Failed to get positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// Get account info
router.get('/account', authenticateToken, async (req, res) => {
  try {
    const virtualPortfolioService = req.app.locals.virtualPortfolioService;
    const account = await virtualPortfolioService.getAccount(req.user.userId);

    res.json(account);
  } catch (error) {
    console.error('Failed to get account:', error);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// Adjust portfolio balance (add or reduce cash)
router.post('/account/adjust-balance', authenticateToken, async (req, res) => {
  try {
    const virtualPortfolioService = req.app.locals.virtualPortfolioService;
    const { amount, type } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    if (!type || !['deposit', 'withdrawal'].includes(type)) {
      return res.status(400).json({ error: 'Type must be either "deposit" or "withdrawal"' });
    }

    const account = await virtualPortfolioService.adjustBalance(req.user.userId, amount, type);

    res.json(account);
  } catch (error) {
    console.error('Failed to adjust balance:', error);
    res.status(500).json({ error: error.message || 'Failed to adjust balance' });
  }
});

module.exports = router;
