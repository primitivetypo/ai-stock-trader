const Redis = require('ioredis');
const crypto = require('crypto');

/**
 * Redis Service
 * Handles caching, rate limiting, and session management
 * Based on kneadStrategy pattern with enhancements for AI trading
 */
class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;

    // Configuration
    this.MAX_RETRIES = 3;
    this.RETRY_DELAY = 1000; // 1 second

    // TTL settings (in seconds)
    this.TTL = {
      MARKET_DATA: 30,        // 30 seconds for quotes
      BAR_DATA: 60,           // 1 minute for bars
      USER_SESSION: 900,      // 15 minutes
      RATE_LIMIT: 60,         // 1 minute for rate limiting
      EXPERIMENT_CACHE: 300,  // 5 minutes for experiment data
    };

    // Rate limits
    this.RATE_LIMITS = {
      ALPACA_API: 200,        // 200 requests per minute (Alpaca limit)
      USER_API: 100,          // 100 requests per minute per user
      BOT_TRADES: 10,         // 10 trades per minute per bot
    };

    this.initialize();
  }

  /**
   * Initialize Redis connection
   */
  initialize() {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        enableOfflineQueue: true,
      };

      // Add password if provided
      if (process.env.REDIS_PASSWORD) {
        redisConfig.password = process.env.REDIS_PASSWORD;
      }

      this.client = new Redis(redisConfig);

      this.client.on('connect', () => {
        console.log('✅ Redis: Connected successfully');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        console.log('✅ Redis: Ready to accept commands');
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis Error:', err.message);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        console.log('🔌 Redis: Connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 Redis: Reconnecting...');
      });

    } catch (error) {
      console.error('❌ Redis initialization failed:', error.message);
      console.warn('⚠️  Application will continue without Redis caching');
    }
  }

  /**
   * Check if Redis is connected
   */
  isReady() {
    return this.isConnected && this.client && this.client.status === 'ready';
  }

  /**
   * Retry operation with exponential backoff
   */
  async retryOperation(operation, retries = this.MAX_RETRIES) {
    try {
      return await operation();
    } catch (error) {
      if (retries > 0 && this.shouldRetry(error)) {
        console.log(`🔄 Retrying operation, ${retries} attempts remaining`);
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        return this.retryOperation(operation, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Determine if error is retryable
   */
  shouldRetry(error) {
    const retryableErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'];
    return retryableErrors.some(code => error.code === code || error.message.includes(code));
  }

  // ==================== MARKET DATA CACHING ====================

  /**
   * Cache market quote data
   */
  async cacheQuote(symbol, quoteData) {
    if (!this.isReady()) return false;

    try {
      const key = `market:quote:${symbol}`;
      await this.retryOperation(async () => {
        await this.client.setex(key, this.TTL.MARKET_DATA, JSON.stringify(quoteData));
      });
      return true;
    } catch (error) {
      console.error(`Failed to cache quote for ${symbol}:`, error.message);
      return false;
    }
  }

  /**
   * Get cached quote
   */
  async getCachedQuote(symbol) {
    if (!this.isReady()) return null;

    try {
      const key = `market:quote:${symbol}`;
      const data = await this.retryOperation(async () => {
        return await this.client.get(key);
      });
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Failed to get cached quote for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Cache bar data
   */
  async cacheBars(symbol, timeframe, barData) {
    if (!this.isReady()) return false;

    try {
      const key = `market:bars:${symbol}:${timeframe}`;
      await this.retryOperation(async () => {
        await this.client.setex(key, this.TTL.BAR_DATA, JSON.stringify(barData));
      });
      return true;
    } catch (error) {
      console.error(`Failed to cache bars for ${symbol}:`, error.message);
      return false;
    }
  }

  /**
   * Get cached bars
   */
  async getCachedBars(symbol, timeframe) {
    if (!this.isReady()) return null;

    try {
      const key = `market:bars:${symbol}:${timeframe}`;
      const data = await this.retryOperation(async () => {
        return await this.client.get(key);
      });
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Failed to get cached bars for ${symbol}:`, error.message);
      return null;
    }
  }

  // ==================== RATE LIMITING ====================

  /**
   * Check Alpaca API rate limit
   * Returns true if request is allowed
   */
  async checkAlpacaRateLimit() {
    if (!this.isReady()) return true; // Allow if Redis is down

    try {
      const key = `ratelimit:alpaca:${Math.floor(Date.now() / 60000)}`;
      const count = await this.retryOperation(async () => {
        const newCount = await this.client.incr(key);
        await this.client.expire(key, this.TTL.RATE_LIMIT);
        return newCount;
      });

      if (count > this.RATE_LIMITS.ALPACA_API) {
        console.warn(`⚠️  Alpaca API rate limit exceeded: ${count}/${this.RATE_LIMITS.ALPACA_API}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Rate limit check failed:', error.message);
      return true; // Fail open
    }
  }

  /**
   * Check user API rate limit
   */
  async checkUserRateLimit(userId) {
    if (!this.isReady()) return true;

    try {
      const key = `ratelimit:user:${userId}:${Math.floor(Date.now() / 60000)}`;
      const count = await this.retryOperation(async () => {
        const newCount = await this.client.incr(key);
        await this.client.expire(key, this.TTL.RATE_LIMIT);
        return newCount;
      });

      return count <= this.RATE_LIMITS.USER_API;
    } catch (error) {
      console.error('User rate limit check failed:', error.message);
      return true;
    }
  }

  /**
   * Check bot trading rate limit
   */
  async checkBotTradeLimit(botId) {
    if (!this.isReady()) return true;

    try {
      const key = `ratelimit:bot:${botId}:${Math.floor(Date.now() / 60000)}`;
      const count = await this.retryOperation(async () => {
        const newCount = await this.client.incr(key);
        await this.client.expire(key, this.TTL.RATE_LIMIT);
        return newCount;
      });

      if (count > this.RATE_LIMITS.BOT_TRADES) {
        console.warn(`⚠️  Bot ${botId} trade rate limit exceeded: ${count}/${this.RATE_LIMITS.BOT_TRADES}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Bot trade limit check failed:', error.message);
      return true;
    }
  }

  /**
   * Get current rate limit counts
   */
  async getRateLimitStatus(type, identifier) {
    if (!this.isReady()) return { count: 0, limit: 0, remaining: 0 };

    try {
      const key = `ratelimit:${type}:${identifier}:${Math.floor(Date.now() / 60000)}`;
      const count = await this.client.get(key);
      const currentCount = parseInt(count) || 0;

      let limit;
      switch (type) {
        case 'alpaca': limit = this.RATE_LIMITS.ALPACA_API; break;
        case 'user': limit = this.RATE_LIMITS.USER_API; break;
        case 'bot': limit = this.RATE_LIMITS.BOT_TRADES; break;
        default: limit = 100;
      }

      return {
        count: currentCount,
        limit,
        remaining: Math.max(0, limit - currentCount)
      };
    } catch (error) {
      console.error('Get rate limit status failed:', error.message);
      return { count: 0, limit: 0, remaining: 0 };
    }
  }

  // ==================== EXPERIMENT/BOT CACHING ====================

  /**
   * Cache experiment data
   */
  async cacheExperiment(experimentId, data) {
    if (!this.isReady()) return false;

    try {
      const key = `experiment:${experimentId}`;
      await this.retryOperation(async () => {
        await this.client.setex(key, this.TTL.EXPERIMENT_CACHE, JSON.stringify(data));
      });
      return true;
    } catch (error) {
      console.error(`Failed to cache experiment ${experimentId}:`, error.message);
      return false;
    }
  }

  /**
   * Get cached experiment
   */
  async getCachedExperiment(experimentId) {
    if (!this.isReady()) return null;

    try {
      const key = `experiment:${experimentId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Failed to get cached experiment ${experimentId}:`, error.message);
      return null;
    }
  }

  /**
   * Invalidate experiment cache
   */
  async invalidateExperiment(experimentId) {
    if (!this.isReady()) return false;

    try {
      const key = `experiment:${experimentId}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`Failed to invalidate experiment ${experimentId}:`, error.message);
      return false;
    }
  }

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Store user session
   */
  async storeSession(userId, sessionData) {
    if (!this.isReady()) return false;

    try {
      const key = `session:${userId}`;
      await this.retryOperation(async () => {
        await this.client.setex(key, this.TTL.USER_SESSION, JSON.stringify(sessionData));
      });
      return true;
    } catch (error) {
      console.error(`Failed to store session for user ${userId}:`, error.message);
      return false;
    }
  }

  /**
   * Get user session
   */
  async getSession(userId) {
    if (!this.isReady()) return null;

    try {
      const key = `session:${userId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Failed to get session for user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Delete user session
   */
  async deleteSession(userId) {
    if (!this.isReady()) return false;

    try {
      const key = `session:${userId}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`Failed to delete session for user ${userId}:`, error.message);
      return false;
    }
  }

  // ==================== UTILITY ====================

  /**
   * Clear all cache with pattern
   */
  async clearPattern(pattern) {
    if (!this.isReady()) return 0;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        console.log(`🧹 Cleared ${keys.length} keys matching ${pattern}`);
        return keys.length;
      }
      return 0;
    } catch (error) {
      console.error(`Failed to clear pattern ${pattern}:`, error.message);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    if (!this.isReady()) return null;

    try {
      const info = await this.client.info('stats');
      const dbSize = await this.client.dbsize();

      return {
        connected: this.isConnected,
        dbSize,
        info: info.split('\r\n').reduce((acc, line) => {
          const [key, value] = line.split(':');
          if (key && value) acc[key] = value;
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('Failed to get Redis stats:', error.message);
      return null;
    }
  }

  /**
   * Gracefully close Redis connection
   */
  async close() {
    if (this.client) {
      await this.client.quit();
      console.log('✅ Redis connection closed gracefully');
    }
  }
}

// Singleton instance
let redisServiceInstance = null;

module.exports = {
  getRedisService: () => {
    if (!redisServiceInstance) {
      redisServiceInstance = new RedisService();
    }
    return redisServiceInstance;
  },
  RedisService
};
