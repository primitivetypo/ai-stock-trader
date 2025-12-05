const express = require('express');
const router = express.Router();
const pool = require('../db/database');
const { authenticateToken } = require('./auth');

/**
 * Get AI analysis logs for an experiment
 * Returns detailed AI conversation history including prompts, responses, and function calls
 */
router.get('/experiment/:experimentId', authenticateToken, async (req, res) => {
  try {
    const { experimentId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verify user owns this experiment
    const expResult = await pool.query(
      'SELECT * FROM experiments WHERE id = $1 AND user_id = $2',
      [experimentId, req.user.userId]
    );

    if (expResult.rows.length === 0) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    // Get AI analysis logs
    const result = await pool.query(
      `SELECT * FROM ai_analysis_log
       WHERE experiment_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [experimentId, parseInt(limit), parseInt(offset)]
    );

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM ai_analysis_log WHERE experiment_id = $1',
      [experimentId]
    );

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Failed to get AI analysis logs:', error);
    res.status(500).json({ error: 'Failed to fetch AI analysis logs' });
  }
});

/**
 * Get AI analysis logs for a specific bot
 */
router.get('/bot/:botId', authenticateToken, async (req, res) => {
  try {
    const { botId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Get AI analysis logs
    const result = await pool.query(
      `SELECT * FROM ai_analysis_log
       WHERE bot_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [botId, parseInt(limit), parseInt(offset)]
    );

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM ai_analysis_log WHERE bot_id = $1',
      [botId]
    );

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Failed to get bot AI analysis logs:', error);
    res.status(500).json({ error: 'Failed to fetch AI analysis logs' });
  }
});

/**
 * Get a single AI analysis log by ID
 */
router.get('/:logId', authenticateToken, async (req, res) => {
  try {
    const { logId } = req.params;

    const result = await pool.query(
      'SELECT * FROM ai_analysis_log WHERE id = $1',
      [logId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Analysis log not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to get AI analysis log:', error);
    res.status(500).json({ error: 'Failed to fetch AI analysis log' });
  }
});

/**
 * Get AI analysis summary statistics for an experiment
 */
router.get('/stats/:experimentId', authenticateToken, async (req, res) => {
  try {
    const { experimentId } = req.params;

    // Get statistics
    const statsResult = await pool.query(
      `SELECT
        COUNT(*) as total_analyses,
        COUNT(CASE WHEN decision = 'BUY' THEN 1 END) as buy_decisions,
        COUNT(CASE WHEN decision = 'SELL' THEN 1 END) as sell_decisions,
        COUNT(CASE WHEN decision = 'SKIP' THEN 1 END) as skip_decisions,
        COUNT(CASE WHEN trade_executed = true THEN 1 END) as trades_executed,
        AVG(confidence_score) as avg_confidence,
        AVG(processing_time_ms) as avg_processing_time,
        MAX(created_at) as last_analysis
       FROM ai_analysis_log
       WHERE experiment_id = $1`,
      [experimentId]
    );

    // Get recent decisions breakdown
    const recentResult = await pool.query(
      `SELECT decision, COUNT(*) as count
       FROM ai_analysis_log
       WHERE experiment_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
       GROUP BY decision`,
      [experimentId]
    );

    res.json({
      ...statsResult.rows[0],
      recentDecisions: recentResult.rows
    });
  } catch (error) {
    console.error('Failed to get AI analysis stats:', error);
    res.status(500).json({ error: 'Failed to fetch AI analysis stats' });
  }
});

/**
 * Get all AI analysis logs (for dashboard/analytics)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0, decision } = req.query;

    let query = `
      SELECT al.*, e.name as experiment_name
      FROM ai_analysis_log al
      LEFT JOIN experiments e ON al.experiment_id = e.id
      WHERE e.user_id = $1
    `;
    const params = [req.user.userId];

    if (decision && decision !== 'all') {
      query += ` AND al.decision = $2`;
      params.push(decision);
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) FROM ai_analysis_log al
      LEFT JOIN experiments e ON al.experiment_id = e.id
      WHERE e.user_id = $1
    `;
    const countParams = [req.user.userId];

    if (decision && decision !== 'all') {
      countQuery += ` AND al.decision = $2`;
      countParams.push(decision);
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Failed to get AI analysis logs:', error);
    res.status(500).json({ error: 'Failed to fetch AI analysis logs' });
  }
});

module.exports = router;
