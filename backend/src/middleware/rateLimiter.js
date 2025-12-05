const rateLimit = require('express-rate-limit');
const { getRedisService } = require('../services/redisService');

/**
 * Rate limiting middleware configuration
 * Uses Express rate limit with Redis store for distributed rate limiting
 */

// General API rate limiter - More generous for development
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Limit each IP to 1000 requests per minute (very generous)
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit.',
      retryAfter: res.getHeader('RateLimit-Reset')
    });
  }
});

// Strict rate limiter for trading endpoints
const tradeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 trades per minute
  message: {
    error: 'Too many trade requests, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
  handler: (req, res) => {
    console.warn(`⚠️  Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json({
      error: 'Trading rate limit exceeded',
      message: 'You can only make 10 trade requests per minute.',
      retryAfter: res.getHeader('RateLimit-Reset')
    });
  }
});

// Experiment creation rate limiter
const experimentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Limit to 5 experiment creations per 5 minutes
  message: {
    error: 'Too many experiments created, please wait.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Experiment creation rate limit exceeded',
      message: 'You can only create 5 experiments per 5 minutes.',
      retryAfter: res.getHeader('RateLimit-Reset')
    });
  }
});

// Auth rate limiter (stricter for authentication endpoints)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per 15 minutes
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful auth requests
  handler: (req, res) => {
    console.warn(`⚠️  Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Your account has been temporarily locked. Please try again in 15 minutes.',
      retryAfter: res.getHeader('RateLimit-Reset')
    });
  }
});

// Market data rate limiter
const marketDataLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    error: 'Too many market data requests',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Market data rate limit exceeded',
      message: 'You can only make 60 market data requests per minute.',
      retryAfter: res.getHeader('RateLimit-Reset')
    });
  }
});

/**
 * Custom Redis-based rate limiter for per-user limits
 * This works alongside the IP-based limiters above
 */
const createUserRateLimiter = () => {
  return async (req, res, next) => {
    // Only apply if user is authenticated
    if (!req.user || !req.user.userId) {
      return next();
    }

    const redis = getRedisService();
    const userId = req.user.userId;

    try {
      const canProceed = await redis.checkUserRateLimit(userId);

      if (!canProceed) {
        const status = await redis.getRateLimitStatus('user', userId);

        console.warn(`⚠️  User rate limit exceeded for user: ${userId}`);

        return res.status(429).json({
          error: 'User rate limit exceeded',
          message: `You have made ${status.count} requests. Limit is ${status.limit} per minute.`,
          remaining: status.remaining,
          retryAfter: '1 minute'
        });
      }

      // Add rate limit info to response headers
      const status = await redis.getRateLimitStatus('user', userId);
      res.setHeader('X-RateLimit-Limit', status.limit);
      res.setHeader('X-RateLimit-Remaining', status.remaining);
      res.setHeader('X-RateLimit-Used', status.count);

      next();
    } catch (error) {
      console.error('User rate limiter error:', error.message);
      // Fail open - allow request if Redis is down
      next();
    }
  };
};

/**
 * Custom rate limiter for bot trading
 * Prevents bots from trading too frequently
 */
const createBotTradeLimiter = () => {
  return async (req, res, next) => {
    const botId = req.body?.botId || req.params?.botId;

    if (!botId) {
      return next();
    }

    const redis = getRedisService();

    try {
      const canProceed = await redis.checkBotTradeLimit(botId);

      if (!canProceed) {
        const status = await redis.getRateLimitStatus('bot', botId);

        console.warn(`⚠️  Bot trade rate limit exceeded for bot: ${botId}`);

        return res.status(429).json({
          error: 'Bot trading too fast',
          message: `Bot ${botId} has made ${status.count} trades. Limit is ${status.limit} per minute.`,
          remaining: status.remaining,
          retryAfter: '1 minute'
        });
      }

      next();
    } catch (error) {
      console.error('Bot trade limiter error:', error.message);
      // Fail open
      next();
    }
  };
};

module.exports = {
  apiLimiter,
  tradeLimiter,
  experimentLimiter,
  authLimiter,
  marketDataLimiter,
  createUserRateLimiter,
  createBotTradeLimiter
};
