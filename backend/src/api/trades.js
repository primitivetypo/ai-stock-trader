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

module.exports = router;
