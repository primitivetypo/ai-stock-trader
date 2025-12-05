const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');
const pool = require('../db/database');

/**
 * Strategy Marketplace API
 * Browse, discover, and use community-shared trading strategies
 */

// Get all shared strategies with filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      category,
      risk,
      sort = 'popular',
      search,
      featured,
      limit = 20,
      offset = 0
    } = req.query;

    let query = `
      SELECT
        s.*,
        COUNT(DISTINCT r.id) as review_count,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        EXISTS(
          SELECT 1 FROM strategy_favorites sf
          WHERE sf.shared_strategy_id = s.id
          AND sf.user_id = $1
        ) as is_favorited
      FROM shared_strategies s
      LEFT JOIN strategy_reviews r ON s.id = r.shared_strategy_id
      WHERE s.is_active = TRUE
    `;

    const params = [req.user.userId];
    let paramCount = 1;

    // Apply filters
    if (category && category !== 'all') {
      paramCount++;
      query += ` AND s.category = $${paramCount}`;
      params.push(category);
    }

    if (risk) {
      paramCount++;
      query += ` AND s.risk_level = $${paramCount}`;
      params.push(risk);
    }

    if (featured === 'true') {
      query += ` AND s.is_featured = TRUE`;
    }

    if (search) {
      paramCount++;
      query += ` AND (
        s.title ILIKE $${paramCount}
        OR s.description ILIKE $${paramCount}
        OR $${paramCount} = ANY(s.tags)
      )`;
      params.push(`%${search}%`);
    }

    query += ` GROUP BY s.id`;

    // Apply sorting
    switch (sort) {
      case 'popular':
        query += ` ORDER BY s.uses_count DESC, s.favorites_count DESC`;
        break;
      case 'performance':
        query += ` ORDER BY s.performance_30d DESC NULLS LAST`;
        break;
      case 'newest':
        query += ` ORDER BY s.created_at DESC`;
        break;
      case 'rating':
        query += ` ORDER BY avg_rating DESC NULLS LAST, review_count DESC`;
        break;
      default:
        query += ` ORDER BY s.uses_count DESC`;
    }

    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM shared_strategies s
      WHERE s.is_active = TRUE
    `;
    const countParams = [];
    let countParamCount = 0;

    if (category && category !== 'all') {
      countParamCount++;
      countQuery += ` AND s.category = $${countParamCount}`;
      countParams.push(category);
    }

    if (risk) {
      countParamCount++;
      countQuery += ` AND s.risk_level = $${countParamCount}`;
      countParams.push(risk);
    }

    if (featured === 'true') {
      countQuery += ` AND s.is_featured = TRUE`;
    }

    if (search) {
      countParamCount++;
      countQuery += ` AND (
        s.title ILIKE $${countParamCount}
        OR s.description ILIKE $${countParamCount}
      )`;
      countParams.push(`%${search}%`);
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      strategies: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Failed to get strategies:', error);
    res.status(500).json({ error: 'Failed to fetch strategies' });
  }
});

// Get featured strategies
router.get('/featured', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.*,
        COUNT(DISTINCT r.id) as review_count,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        EXISTS(
          SELECT 1 FROM strategy_favorites sf
          WHERE sf.shared_strategy_id = s.id
          AND sf.user_id = $1
        ) as is_favorited
      FROM shared_strategies s
      LEFT JOIN strategy_reviews r ON s.id = r.shared_strategy_id
      WHERE s.is_active = TRUE AND s.is_featured = TRUE
      GROUP BY s.id
      ORDER BY s.uses_count DESC
      LIMIT 6
    `, [req.user.userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Failed to get featured strategies:', error);
    res.status(500).json({ error: 'Failed to fetch featured strategies' });
  }
});

// Get strategy by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        s.*,
        COUNT(DISTINCT r.id) as review_count,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        EXISTS(
          SELECT 1 FROM strategy_favorites sf
          WHERE sf.shared_strategy_id = s.id
          AND sf.user_id = $1
        ) as is_favorited,
        EXISTS(
          SELECT 1 FROM strategy_uses su
          WHERE su.shared_strategy_id = s.id
          AND su.user_id = $1
        ) as is_using
      FROM shared_strategies s
      LEFT JOIN strategy_reviews r ON s.id = r.shared_strategy_id
      WHERE s.id = $2 AND s.is_active = TRUE
      GROUP BY s.id
    `, [req.user.userId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    // Increment views count
    await pool.query(`
      UPDATE shared_strategies
      SET views_count = views_count + 1
      WHERE id = $1
    `, [id]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to get strategy:', error);
    res.status(500).json({ error: 'Failed to fetch strategy' });
  }
});

// Use strategy in experiment
router.post('/:id/use', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { experimentId, botId } = req.body;

    // Check if strategy exists
    const strategyResult = await pool.query(`
      SELECT * FROM shared_strategies
      WHERE id = $1 AND is_active = TRUE
    `, [id]);

    if (strategyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    const strategy = strategyResult.rows[0];

    // Record usage
    await pool.query(`
      INSERT INTO strategy_uses (shared_strategy_id, user_id, experiment_id, bot_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, shared_strategy_id, experiment_id)
      DO UPDATE SET used_at = NOW()
    `, [id, req.user.userId, experimentId, botId]);

    res.json({
      success: true,
      strategy: {
        id: strategy.id,
        title: strategy.title,
        strategy_key: strategy.strategy_key,
        config: strategy.config,
        watchlist: strategy.watchlist
      }
    });
  } catch (error) {
    console.error('Failed to use strategy:', error);
    res.status(500).json({ error: 'Failed to use strategy' });
  }
});

// Favorite/unfavorite strategy
router.post('/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { favorite } = req.body; // true to favorite, false to unfavorite

    if (favorite) {
      // Add favorite
      await pool.query(`
        INSERT INTO strategy_favorites (shared_strategy_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, shared_strategy_id) DO NOTHING
      `, [id, req.user.userId]);
    } else {
      // Remove favorite
      await pool.query(`
        DELETE FROM strategy_favorites
        WHERE shared_strategy_id = $1 AND user_id = $2
      `, [id, req.user.userId]);
    }

    res.json({ success: true, favorited: favorite });
  } catch (error) {
    console.error('Failed to update favorite:', error);
    res.status(500).json({ error: 'Failed to update favorite' });
  }
});

// Get user's favorited strategies
router.get('/user/favorites', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.*,
        COUNT(DISTINCT r.id) as review_count,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        TRUE as is_favorited
      FROM strategy_favorites sf
      JOIN shared_strategies s ON sf.shared_strategy_id = s.id
      LEFT JOIN strategy_reviews r ON s.id = r.shared_strategy_id
      WHERE sf.user_id = $1 AND s.is_active = TRUE
      GROUP BY s.id, sf.favorited_at
      ORDER BY sf.favorited_at DESC
    `, [req.user.userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Failed to get favorites:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// Get strategy reviews
router.get('/:id/reviews', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        r.*,
        COALESCE(u.name, u.email) as username
      FROM strategy_reviews r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.shared_strategy_id = $1
      ORDER BY r.created_at DESC
      LIMIT 50
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Failed to get reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Add/update review
router.post('/:id/review', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment, profitAchieved, timeUsedDays } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    await pool.query(`
      INSERT INTO strategy_reviews (
        shared_strategy_id, user_id, rating, comment,
        profit_achieved, time_used_days
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, shared_strategy_id)
      DO UPDATE SET
        rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        profit_achieved = EXCLUDED.profit_achieved,
        time_used_days = EXCLUDED.time_used_days,
        updated_at = NOW()
    `, [id, req.user.userId, rating, comment, profitAchieved, timeUsedDays]);

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to add review:', error);
    res.status(500).json({ error: 'Failed to add review' });
  }
});

// Get categories
router.get('/meta/categories', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM shared_strategies
      WHERE is_active = TRUE
      GROUP BY category
      ORDER BY count DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Failed to get categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Share a strategy from an experiment
router.post('/share', authenticateToken, async (req, res) => {
  try {
    const { experimentId, botId, title, description, riskLevel, category, tags } = req.body;
    const userId = req.user.userId;

    if (!experimentId || !botId || !title || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get experiment details
    const experimentQuery = await pool.query(
      'SELECT * FROM experiments WHERE id = $1 AND user_id = $2',
      [experimentId, userId]
    );

    if (experimentQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Experiment not found or not owned by you' });
    }

    const experiment = experimentQuery.rows[0];

    // Get bot details from experiment config
    const botConfig = experiment.config.bots.find(b => b.id === botId);
    if (!botConfig) {
      return res.status(404).json({ error: 'Bot not found in experiment' });
    }

    // Get bot performance metrics
    const metricsQuery = await pool.query(
      `SELECT * FROM experiment_results
       WHERE experiment_id = $1 AND bot_id = $2
       ORDER BY timestamp DESC LIMIT 1`,
      [experimentId, botId]
    );

    let performanceMetrics = {
      performance_30d: 0,
      win_rate: 0
    };

    if (metricsQuery.rows.length > 0) {
      const metrics = metricsQuery.rows[0].metrics;
      performanceMetrics.performance_30d = metrics.returnPercent || 0;
      performanceMetrics.win_rate = metrics.winRate || 0;
    }

    // Create shared strategy
    const insertQuery = await pool.query(
      `INSERT INTO shared_strategies (
        title, description, strategy_key, creator_user_id, creator_name,
        risk_level, category, tags, config, watchlist,
        performance_30d, win_rate, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        title,
        description,
        botConfig.strategy,
        userId,
        req.user.email || 'Anonymous',
        riskLevel,
        category,
        tags || [],
        botConfig.config || {},
        experiment.config.watchlist || [],
        performanceMetrics.performance_30d,
        performanceMetrics.win_rate,
        true
      ]
    );

    const sharedStrategy = insertQuery.rows[0];

    res.json({
      success: true,
      strategy: sharedStrategy
    });
  } catch (error) {
    console.error('Failed to share strategy:', error);
    res.status(500).json({ error: 'Failed to share strategy' });
  }
});

module.exports = router;
