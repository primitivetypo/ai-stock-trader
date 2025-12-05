const { EventEmitter } = require('events');
const axios = require('axios');
const crypto = require('crypto');
const pool = require('../db/database');

/**
 * News Aggregator Service
 * Aggregates news from multiple reliable REST-based sources
 * Replaces the unreliable Alpaca WebSocket news stream
 */
class NewsAggregatorService extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.pollInterval = null;
    this.pollFrequency = parseInt(process.env.NEWS_POLL_FREQUENCY) || 30000; // 30 seconds
    this.processedHashes = new Set(); // Deduplication
    this.maxHashSetSize = 10000;
    this.articlesProcessed = 0;
    this.lastArticleTime = null;
    this.statusId = null;
    this.errors = [];

    // API configurations
    this.sources = {
      finnhub: {
        enabled: !!process.env.FINNHUB_API_KEY,
        apiKey: process.env.FINNHUB_API_KEY,
        baseUrl: 'https://finnhub.io/api/v1',
        rateLimit: 60, // calls per minute
        lastCall: 0
      },
      alphaVantage: {
        enabled: !!process.env.ALPHA_VANTAGE_API_KEY,
        apiKey: process.env.ALPHA_VANTAGE_API_KEY,
        baseUrl: 'https://www.alphavantage.co/query',
        rateLimit: 5, // calls per minute (free tier)
        lastCall: 0
      },
      newsApi: {
        enabled: !!process.env.NEWSAPI_KEY,
        apiKey: process.env.NEWSAPI_KEY,
        baseUrl: 'https://newsapi.org/v2',
        rateLimit: 100, // calls per day (free tier)
        dailyCalls: 0,
        lastResetDate: new Date().toDateString()
      },
      polygon: {
        enabled: !!process.env.POLYGON_API_KEY,
        apiKey: process.env.POLYGON_API_KEY,
        baseUrl: 'https://api.polygon.io/v2',
        rateLimit: 5, // calls per minute (free tier)
        lastCall: 0
      }
    };

    // Watchlist for targeted news (set by trading bots)
    this.watchlist = new Set();

    console.log('📰 News Aggregator initialized');
    console.log(`   Sources enabled: ${Object.entries(this.sources).filter(([_, s]) => s.enabled).map(([k]) => k).join(', ') || 'None (using simulated news)'}`);
  }

  /**
   * Start the news aggregation service
   */
  async start() {
    if (this.isRunning) {
      console.log('📰 News Aggregator already running');
      return true;
    }

    console.log('🚀 Starting News Aggregator Service...');
    await this.updateStreamStatus('connecting');

    this.isRunning = true;
    await this.updateStreamStatus('connected');

    // Initial poll
    await this.pollAllSources();

    // Start polling interval
    this.pollInterval = setInterval(() => {
      this.pollAllSources();
    }, this.pollFrequency);

    console.log(`✅ News Aggregator started (polling every ${this.pollFrequency / 1000}s)`);
    return true;
  }

  /**
   * Stop the news aggregation service
   */
  async stop() {
    if (!this.isRunning) return;

    console.log('🛑 Stopping News Aggregator...');

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.isRunning = false;
    await this.updateStreamStatus('disconnected');
    console.log('✅ News Aggregator stopped');
  }

  /**
   * Add symbols to watchlist for targeted news
   */
  addSymbols(symbols) {
    symbols.forEach(symbol => this.watchlist.add(symbol.toUpperCase()));
    console.log(`📰 Watchlist updated: ${Array.from(this.watchlist).join(', ')}`);
  }

  /**
   * Remove symbols from watchlist
   */
  removeSymbols(symbols) {
    symbols.forEach(symbol => this.watchlist.delete(symbol.toUpperCase()));
  }

  /**
   * Poll all enabled news sources
   */
  async pollAllSources() {
    const articles = [];

    try {
      // Poll each enabled source
      if (this.sources.finnhub.enabled) {
        const finnhubNews = await this.pollFinnhub();
        articles.push(...finnhubNews);
      }

      if (this.sources.alphaVantage.enabled) {
        const alphaNews = await this.pollAlphaVantage();
        articles.push(...alphaNews);
      }

      if (this.sources.newsApi.enabled) {
        const newsApiArticles = await this.pollNewsApi();
        articles.push(...newsApiArticles);
      }

      if (this.sources.polygon.enabled) {
        const polygonNews = await this.pollPolygon();
        articles.push(...polygonNews);
      }

      // If no sources enabled, generate simulated financial news for testing
      if (!this.hasEnabledSources()) {
        const simulatedNews = await this.generateSimulatedNews();
        articles.push(...simulatedNews);
      }

      // Process and emit new articles
      for (const article of articles) {
        await this.processArticle(article);
      }

    } catch (error) {
      console.error('❌ Error polling news sources:', error.message);
      this.errors.push({ time: new Date(), error: error.message });
      if (this.errors.length > 100) this.errors.shift();
    }
  }

  /**
   * Check if any sources are enabled
   */
  hasEnabledSources() {
    return Object.values(this.sources).some(s => s.enabled);
  }

  /**
   * Poll Finnhub for company and market news
   */
  async pollFinnhub() {
    const articles = [];
    const config = this.sources.finnhub;

    // Rate limiting
    const now = Date.now();
    if (now - config.lastCall < 60000 / config.rateLimit) {
      return articles;
    }
    config.lastCall = now;

    try {
      // Get general market news
      const marketResponse = await axios.get(`${config.baseUrl}/news`, {
        params: {
          category: 'general',
          token: config.apiKey
        },
        timeout: 10000
      });

      if (marketResponse.data && Array.isArray(marketResponse.data)) {
        for (const item of marketResponse.data.slice(0, 10)) {
          articles.push(this.normalizeFinnhubArticle(item));
        }
      }

      // Get company-specific news for watchlist
      for (const symbol of Array.from(this.watchlist).slice(0, 5)) {
        try {
          const companyResponse = await axios.get(`${config.baseUrl}/company-news`, {
            params: {
              symbol,
              from: this.getDateString(-1), // Yesterday
              to: this.getDateString(0), // Today
              token: config.apiKey
            },
            timeout: 10000
          });

          if (companyResponse.data && Array.isArray(companyResponse.data)) {
            for (const item of companyResponse.data.slice(0, 3)) {
              articles.push(this.normalizeFinnhubArticle(item, symbol));
            }
          }
        } catch (err) {
          console.warn(`⚠️ Finnhub company news error for ${symbol}:`, err.message);
        }
      }

    } catch (error) {
      console.error('❌ Finnhub polling error:', error.message);
    }

    return articles;
  }

  /**
   * Normalize Finnhub article to standard format
   */
  normalizeFinnhubArticle(item, symbol = null) {
    return {
      headline: item.headline,
      summary: item.summary,
      content: item.summary, // Finnhub doesn't provide full content
      symbols: symbol ? [symbol] : this.extractSymbols(item.headline + ' ' + item.summary),
      source: item.source || 'Finnhub',
      url: item.url,
      created_at: new Date(item.datetime * 1000).toISOString(),
      sentiment: item.sentiment || null,
      provider: 'finnhub'
    };
  }

  /**
   * Poll Alpha Vantage for news sentiment
   */
  async pollAlphaVantage() {
    const articles = [];
    const config = this.sources.alphaVantage;

    // Rate limiting (very strict for free tier)
    const now = Date.now();
    if (now - config.lastCall < 60000 / config.rateLimit) {
      return articles;
    }
    config.lastCall = now;

    try {
      // Get news for watchlist symbols
      const tickers = Array.from(this.watchlist).slice(0, 3).join(',');

      if (!tickers) return articles;

      const response = await axios.get(config.baseUrl, {
        params: {
          function: 'NEWS_SENTIMENT',
          tickers,
          apikey: config.apiKey
        },
        timeout: 15000
      });

      if (response.data && response.data.feed) {
        for (const item of response.data.feed.slice(0, 10)) {
          articles.push(this.normalizeAlphaVantageArticle(item));
        }
      }

    } catch (error) {
      console.error('❌ Alpha Vantage polling error:', error.message);
    }

    return articles;
  }

  /**
   * Normalize Alpha Vantage article to standard format
   */
  normalizeAlphaVantageArticle(item) {
    const symbols = item.ticker_sentiment?.map(t => t.ticker) || [];
    const avgSentiment = item.ticker_sentiment?.reduce((sum, t) =>
      sum + parseFloat(t.ticker_sentiment_score || 0), 0) / (item.ticker_sentiment?.length || 1);

    return {
      headline: item.title,
      summary: item.summary,
      content: item.summary,
      symbols,
      source: item.source || 'Alpha Vantage',
      url: item.url,
      created_at: item.time_published,
      sentiment: avgSentiment,
      provider: 'alpha_vantage'
    };
  }

  /**
   * Poll NewsAPI for business/financial news
   */
  async pollNewsApi() {
    const articles = [];
    const config = this.sources.newsApi;

    // Reset daily counter if new day
    const today = new Date().toDateString();
    if (config.lastResetDate !== today) {
      config.dailyCalls = 0;
      config.lastResetDate = today;
    }

    // Daily rate limiting (100 calls/day for free tier)
    if (config.dailyCalls >= config.rateLimit) {
      return articles;
    }
    config.dailyCalls++;

    try {
      // Search for financial/stock news
      const response = await axios.get(`${config.baseUrl}/everything`, {
        params: {
          q: 'stock market OR earnings OR trading OR financial',
          language: 'en',
          sortBy: 'publishedAt',
          pageSize: 10,
          apiKey: config.apiKey
        },
        timeout: 10000
      });

      if (response.data && response.data.articles) {
        for (const item of response.data.articles) {
          articles.push(this.normalizeNewsApiArticle(item));
        }
      }

    } catch (error) {
      console.error('❌ NewsAPI polling error:', error.message);
    }

    return articles;
  }

  /**
   * Normalize NewsAPI article to standard format
   */
  normalizeNewsApiArticle(item) {
    const text = (item.title || '') + ' ' + (item.description || '');
    return {
      headline: item.title,
      summary: item.description,
      content: item.content || item.description,
      symbols: this.extractSymbols(text),
      source: item.source?.name || 'NewsAPI',
      url: item.url,
      created_at: item.publishedAt,
      sentiment: null,
      provider: 'newsapi'
    };
  }

  /**
   * Poll Polygon for news
   */
  async pollPolygon() {
    const articles = [];
    const config = this.sources.polygon;

    // Rate limiting
    const now = Date.now();
    if (now - config.lastCall < 60000 / config.rateLimit) {
      return articles;
    }
    config.lastCall = now;

    try {
      const response = await axios.get(`${config.baseUrl}/reference/news`, {
        params: {
          limit: 10,
          order: 'desc',
          apiKey: config.apiKey
        },
        timeout: 10000
      });

      if (response.data && response.data.results) {
        for (const item of response.data.results) {
          articles.push(this.normalizePolygonArticle(item));
        }
      }

    } catch (error) {
      console.error('❌ Polygon polling error:', error.message);
    }

    return articles;
  }

  /**
   * Normalize Polygon article to standard format
   */
  normalizePolygonArticle(item) {
    return {
      headline: item.title,
      summary: item.description,
      content: item.description,
      symbols: item.tickers || [],
      source: item.publisher?.name || 'Polygon',
      url: item.article_url,
      created_at: item.published_utc,
      sentiment: null,
      provider: 'polygon'
    };
  }

  /**
   * Generate simulated financial news for testing when no API keys configured
   */
  async generateSimulatedNews() {
    // Only generate every 5 polls (2.5 minutes) to avoid spam
    if (Math.random() > 0.2) return [];

    const symbols = Array.from(this.watchlist);
    if (symbols.length === 0) return [];

    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const templates = [
      {
        headline: `${symbol} Reports Strong Q4 Earnings, Beats Analyst Expectations`,
        sentiment: 0.8,
        type: 'earnings'
      },
      {
        headline: `${symbol} Announces New Product Launch, Stock Rallies`,
        sentiment: 0.7,
        type: 'product'
      },
      {
        headline: `${symbol} Faces Regulatory Scrutiny Over Recent Practices`,
        sentiment: -0.6,
        type: 'regulatory'
      },
      {
        headline: `Analysts Upgrade ${symbol} to Buy Rating with $${Math.floor(100 + Math.random() * 200)} Price Target`,
        sentiment: 0.75,
        type: 'analyst'
      },
      {
        headline: `${symbol} CEO Announces Resignation, Interim Leadership Appointed`,
        sentiment: -0.5,
        type: 'management'
      },
      {
        headline: `${symbol} Partners with Major Tech Company for AI Integration`,
        sentiment: 0.65,
        type: 'partnership'
      },
      {
        headline: `${symbol} Misses Revenue Expectations, Guidance Lowered`,
        sentiment: -0.7,
        type: 'earnings'
      },
      {
        headline: `Breaking: ${symbol} Announces $${Math.floor(1 + Math.random() * 10)}B Stock Buyback Program`,
        sentiment: 0.6,
        type: 'buyback'
      },
      {
        headline: `${symbol} Expands into International Markets, Growth Outlook Positive`,
        sentiment: 0.55,
        type: 'expansion'
      },
      {
        headline: `Short Interest in ${symbol} Increases Significantly, Bears Target Stock`,
        sentiment: -0.4,
        type: 'short'
      }
    ];

    const template = templates[Math.floor(Math.random() * templates.length)];

    return [{
      headline: template.headline,
      summary: `This is simulated news for testing the AI trading system. ${template.headline}. Market analysts are closely watching ${symbol} following this development.`,
      content: `This is simulated news for testing purposes. ${template.headline}`,
      symbols: [symbol],
      source: 'Simulated News (Testing)',
      url: `https://example.com/news/${Date.now()}`,
      created_at: new Date().toISOString(),
      sentiment: template.sentiment,
      provider: 'simulated'
    }];
  }

  /**
   * Process and emit article if not duplicate
   */
  async processArticle(article) {
    // Generate hash for deduplication
    const hash = this.generateHash(article);

    if (this.processedHashes.has(hash)) {
      return; // Duplicate
    }

    // Add to processed set
    this.processedHashes.add(hash);

    // Clean up old hashes if set is too large
    if (this.processedHashes.size > this.maxHashSetSize) {
      const hashArray = Array.from(this.processedHashes);
      this.processedHashes = new Set(hashArray.slice(-this.maxHashSetSize / 2));
    }

    // Update stats
    this.articlesProcessed++;
    this.lastArticleTime = new Date();

    console.log(`📰 [${article.provider}] ${article.headline.substring(0, 60)}...`);
    if (article.symbols.length > 0) {
      console.log(`   Symbols: ${article.symbols.join(', ')}`);
    }

    // Emit news event for AI bots
    this.emit('news', {
      headline: article.headline,
      summary: article.summary,
      content: article.content,
      symbols: article.symbols,
      source: article.source,
      url: article.url,
      created_at: article.created_at,
      sentiment: article.sentiment,
      provider: article.provider
    });

    // Update stream status
    await this.updateStreamStatus('connected');
  }

  /**
   * Generate hash for article deduplication
   */
  generateHash(article) {
    const content = `${article.headline}${article.url}${article.source}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Extract stock symbols from text
   */
  extractSymbols(text) {
    const symbols = [];

    // Common stock symbol patterns
    const patterns = [
      /\$([A-Z]{1,5})\b/g, // $AAPL format
      /\b([A-Z]{2,5})\b(?=\s+(?:stock|shares|earnings|revenue|CEO|announces))/gi
    ];

    // Known company -> symbol mappings
    const companyMappings = {
      'apple': 'AAPL',
      'microsoft': 'MSFT',
      'google': 'GOOGL',
      'alphabet': 'GOOGL',
      'amazon': 'AMZN',
      'tesla': 'TSLA',
      'nvidia': 'NVDA',
      'meta': 'META',
      'facebook': 'META',
      'netflix': 'NFLX',
      'amd': 'AMD',
      'intel': 'INTC',
      'disney': 'DIS',
      'walmart': 'WMT',
      'jpmorgan': 'JPM',
      'goldman sachs': 'GS',
      'bank of america': 'BAC',
      'berkshire': 'BRK.A',
      'coca-cola': 'KO',
      'pepsi': 'PEP',
      'johnson & johnson': 'JNJ',
      'pfizer': 'PFE',
      'moderna': 'MRNA',
      'exxon': 'XOM',
      'chevron': 'CVX'
    };

    // Check for $SYMBOL pattern
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const symbol = match[1].toUpperCase();
        if (symbol.length >= 2 && symbol.length <= 5 && !symbols.includes(symbol)) {
          symbols.push(symbol);
        }
      }
    }

    // Check for company names
    const lowerText = text.toLowerCase();
    for (const [company, symbol] of Object.entries(companyMappings)) {
      if (lowerText.includes(company) && !symbols.includes(symbol)) {
        symbols.push(symbol);
      }
    }

    // Filter to only symbols in watchlist if watchlist is not empty
    if (this.watchlist.size > 0) {
      return symbols.filter(s => this.watchlist.has(s));
    }

    return symbols.slice(0, 5); // Limit to 5 symbols
  }

  /**
   * Get date string for API calls
   */
  getDateString(daysOffset = 0) {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split('T')[0];
  }

  /**
   * Update stream status in database
   */
  async updateStreamStatus(status, errorMessage = null) {
    try {
      if (!this.statusId) {
        const result = await pool.query(
          `INSERT INTO ai_news_stream_status
           (stream_name, status, connected_at, articles_processed, last_article_at, error_message)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            'news-aggregator',
            status,
            status === 'connected' ? new Date() : null,
            this.articlesProcessed,
            this.lastArticleTime,
            errorMessage
          ]
        );
        this.statusId = result.rows[0].id;
      } else {
        await pool.query(
          `UPDATE ai_news_stream_status
           SET status = $1,
               disconnected_at = $2,
               articles_processed = $3,
               last_article_at = $4,
               error_message = $5,
               updated_at = NOW()
           WHERE id = $6`,
          [
            status,
            status === 'disconnected' || status === 'error' ? new Date() : null,
            this.articlesProcessed,
            this.lastArticleTime,
            errorMessage,
            this.statusId
          ]
        );
      }
    } catch (error) {
      console.error('❌ Failed to update stream status:', error.message);
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      articlesProcessed: this.articlesProcessed,
      lastArticleTime: this.lastArticleTime,
      watchlistSize: this.watchlist.size,
      enabledSources: Object.entries(this.sources)
        .filter(([_, s]) => s.enabled)
        .map(([k]) => k),
      recentErrors: this.errors.slice(-5)
    };
  }

  /**
   * Get service statistics
   */
  async getStatistics() {
    try {
      const result = await pool.query(
        `SELECT
          stream_name,
          status,
          connected_at,
          disconnected_at,
          articles_processed,
          last_article_at,
          updated_at
         FROM ai_news_stream_status
         WHERE stream_name = 'news-aggregator'
         ORDER BY updated_at DESC
         LIMIT 1`
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('❌ Failed to get stream statistics:', error.message);
      return null;
    }
  }
}

// Export singleton instance
let newsAggregatorServiceInstance = null;

module.exports = {
  getNewsAggregatorService: () => {
    if (!newsAggregatorServiceInstance) {
      newsAggregatorServiceInstance = new NewsAggregatorService();
    }
    return newsAggregatorServiceInstance;
  },
  NewsAggregatorService
};
