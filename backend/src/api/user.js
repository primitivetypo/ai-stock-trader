const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');

// Get user's Alpaca credentials
router.get('/alpaca-credentials', authenticateToken, (req, res) => {
  // This route allows the system to get user-specific Alpaca keys
  // Never expose the actual keys to the frontend
  res.json({
    hasKeys: true,
    message: 'Credentials configured'
  });
});

module.exports = router;
