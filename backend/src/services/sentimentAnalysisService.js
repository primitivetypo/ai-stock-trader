/**
 * Sentiment Analysis Service
 * Aggregates sentiment from multiple sources and provides trading signals
 * Sources:
 * - News sentiment (from news aggregator)
 * - Social media (Reddit, Twitter)
 * - Market indicators (Fear & Greed, VIX)
 */

const axios = require('axios');
const pool = require('../db/database');

class SentimentAnalysisService {
  constructor(config = {}) {
    this.config = {
      // Sentiment thresholds
      bullishThreshold: config.bullishThreshold || 0.6,
      bearishThreshold: config.bearishThreshold || -0.4,
      extremeBullish: config.extremeBullish || 0.8,
      extremeBearish: config.extremeBearish || -0.7,

      // Contrarian settings (extreme sentiment = reversal likely)
      enableContrarian: config.enableContrarian !== false,
      contrarianThreshold: config.contrarianThreshold || 0.85,

      // Source weights
      weights: {
        news: config.newsWeight || 0.35,
        social: config.socialWeight || 0.25,
        market: config.marketWeight || 0.25,
        technical: config.technicalWeight || 0.15
      },

      // Cache settings
      cacheMinutes: config.cacheMinutes || 5
    };

    // Sentiment cache
    this.sentimentCache = new Map();
    this.marketSentimentCache = null;
    this.lastMarketUpdate = null;
  }

  /**
   * Get aggregated sentiment for a symbol
   */
  async getSentiment(symbol) {
    // Check cache
    const cached = this.sentimentCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.config.cacheMinutes * 60000) {
      return cached.data;
    }

    // Gather sentiment from all sources
    const [newsSentiment, socialSentiment, technicalSentiment] = await Promise.all([
      this.getNewsSentiment(symbol),
      this.getSocialSentiment(symbol),
      this.getTechnicalSentiment(symbol)
    ]);

    const marketSentiment = await this.getMarketSentiment();

    // Calculate weighted average
    const weights = this.config.weights;
    const aggregatedScore =
      (newsSentiment.score * weights.news) +
      (socialSentiment.score * weights.social) +
      (marketSentiment.score * weights.market) +
      (technicalSentiment.score * weights.technical);

    // Determine sentiment label
    let label = 'neutral';
    if (aggregatedScore >= this.config.extremeBullish) label = 'extremely_bullish';
    else if (aggregatedScore >= this.config.bullishThreshold) label = 'bullish';
    else if (aggregatedScore <= this.config.extremeBearish) label = 'extremely_bearish';
    else if (aggregatedScore <= this.config.bearishThreshold) label = 'bearish';

    // Check for contrarian signal
    let contrarianSignal = null;
    if (this.config.enableContrarian) {
      if (aggregatedScore > this.config.contrarianThreshold) {
        contrarianSignal = {
          direction: 'bearish',
          reason: 'Extreme bullish sentiment often precedes corrections'
        };
      } else if (aggregatedScore < -this.config.contrarianThreshold) {
        contrarianSignal = {
          direction: 'bullish',
          reason: 'Extreme bearish sentiment often precedes rallies'
        };
      }
    }

    const result = {
      symbol,
      score: aggregatedScore,
      label,
      contrarianSignal,
      sources: {
        news: newsSentiment,
        social: socialSentiment,
        market: marketSentiment,
        technical: technicalSentiment
      },
      weights: this.config.weights,
      timestamp: new Date(),
      recommendation: this.getRecommendation(aggregatedScore, contrarianSignal)
    };

    // Cache result
    this.sentimentCache.set(symbol, { data: result, timestamp: Date.now() });

    // Store in database
    await this.storeSentiment(result);

    return result;
  }

  /**
   * Get news-based sentiment
   */
  async getNewsSentiment(symbol) {
    try {
      // Get recent news articles for this symbol from database
      const result = await pool.query(
        `SELECT headline, summary, sentiment
         FROM ai_news_articles
         WHERE $1 = ANY(symbols)
         AND published_at > NOW() - INTERVAL '24 hours'
         ORDER BY published_at DESC
         LIMIT 20`,
        [symbol]
      );

      if (result.rows.length === 0) {
        return { score: 0, confidence: 0, source: 'news', articles: 0 };
      }

      // Calculate average sentiment
      const sentiments = result.rows
        .filter(row => row.sentiment !== null)
        .map(row => parseFloat(row.sentiment));

      if (sentiments.length === 0) {
        // Analyze headlines if no sentiment scores
        return this.analyzeHeadlineSentiment(result.rows);
      }

      const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
      const confidence = Math.min(sentiments.length / 10, 1); // More articles = more confidence

      return {
        score: avgSentiment,
        confidence,
        source: 'news',
        articles: result.rows.length,
        recentHeadlines: result.rows.slice(0, 3).map(r => r.headline)
      };
    } catch (error) {
      console.error('Error getting news sentiment:', error.message);
      return { score: 0, confidence: 0, source: 'news', error: error.message };
    }
  }

  /**
   * Analyze headline sentiment using keyword matching
   */
  analyzeHeadlineSentiment(articles) {
    const positiveWords = [
      'surge', 'soar', 'rally', 'gain', 'beat', 'exceed', 'strong', 'growth',
      'upgrade', 'bullish', 'breakthrough', 'record', 'profit', 'success',
      'expand', 'innovative', 'partnership', 'acquisition', 'dividend'
    ];

    const negativeWords = [
      'fall', 'drop', 'plunge', 'decline', 'miss', 'weak', 'loss', 'concern',
      'downgrade', 'bearish', 'risk', 'warning', 'lawsuit', 'investigation',
      'layoff', 'recall', 'scandal', 'debt', 'bankruptcy'
    ];

    let totalScore = 0;

    for (const article of articles) {
      const text = (article.headline + ' ' + (article.summary || '')).toLowerCase();
      let articleScore = 0;

      for (const word of positiveWords) {
        if (text.includes(word)) articleScore += 0.1;
      }

      for (const word of negativeWords) {
        if (text.includes(word)) articleScore -= 0.1;
      }

      totalScore += Math.max(-1, Math.min(1, articleScore));
    }

    const avgScore = articles.length > 0 ? totalScore / articles.length : 0;

    return {
      score: avgScore,
      confidence: Math.min(articles.length / 10, 0.7), // Lower confidence for keyword analysis
      source: 'news_keywords',
      articles: articles.length,
      method: 'keyword_analysis'
    };
  }

  /**
   * Get social media sentiment (simulated for now)
   * In production, would integrate with Reddit API, Twitter API, StockTwits
   */
  async getSocialSentiment(symbol) {
    // Simulated social sentiment based on symbol characteristics
    // In production, this would call actual APIs
    const socialIndicators = {
      'TSLA': { base: 0.3, volatility: 0.5 }, // High volatility in sentiment
      'AAPL': { base: 0.2, volatility: 0.2 },
      'NVDA': { base: 0.4, volatility: 0.3 },
      'GME': { base: 0.1, volatility: 0.8 }, // Meme stock
      'AMC': { base: 0.0, volatility: 0.8 },
      'META': { base: 0.1, volatility: 0.3 },
      'GOOGL': { base: 0.15, volatility: 0.2 },
      'MSFT': { base: 0.2, volatility: 0.15 },
      'AMZN': { base: 0.15, volatility: 0.25 }
    };

    const indicator = socialIndicators[symbol] || { base: 0, volatility: 0.3 };

    // Add some randomness to simulate real social sentiment fluctuations
    const randomFactor = (Math.random() - 0.5) * indicator.volatility;
    const score = Math.max(-1, Math.min(1, indicator.base + randomFactor));

    return {
      score,
      confidence: 0.5, // Moderate confidence for simulated data
      source: 'social_simulated',
      mentions: Math.floor(Math.random() * 1000) + 100,
      platforms: {
        reddit: { score: score * 0.9, mentions: Math.floor(Math.random() * 500) },
        twitter: { score: score * 1.1, mentions: Math.floor(Math.random() * 300) },
        stocktwits: { score: score * 0.95, mentions: Math.floor(Math.random() * 200) }
      },
      note: 'Simulated data - integrate real APIs for production'
    };
  }

  /**
   * Get market-wide sentiment (Fear & Greed Index style)
   */
  async getMarketSentiment() {
    // Check cache
    if (this.marketSentimentCache &&
        this.lastMarketUpdate &&
        Date.now() - this.lastMarketUpdate < 15 * 60000) { // 15 min cache
      return this.marketSentimentCache;
    }

    // Calculate market sentiment from multiple factors
    const factors = {
      // These would come from actual market data in production
      marketMomentum: this.calculateMarketMomentum(),
      putCallRatio: this.calculatePutCallSentiment(),
      vixLevel: this.calculateVixSentiment(),
      breadth: this.calculateMarketBreadth(),
      safeHavenDemand: this.calculateSafeHavenDemand()
    };

    // Weight the factors
    const weights = {
      marketMomentum: 0.25,
      putCallRatio: 0.2,
      vixLevel: 0.25,
      breadth: 0.2,
      safeHavenDemand: 0.1
    };

    let totalScore = 0;
    for (const [factor, value] of Object.entries(factors)) {
      totalScore += value.score * weights[factor];
    }

    // Determine Fear & Greed level
    let level = 'neutral';
    if (totalScore > 0.6) level = 'extreme_greed';
    else if (totalScore > 0.3) level = 'greed';
    else if (totalScore < -0.6) level = 'extreme_fear';
    else if (totalScore < -0.3) level = 'fear';

    const result = {
      score: totalScore,
      level,
      confidence: 0.7,
      source: 'market_indicators',
      factors,
      fearGreedIndex: Math.round((totalScore + 1) * 50), // Convert to 0-100 scale
      timestamp: new Date()
    };

    this.marketSentimentCache = result;
    this.lastMarketUpdate = Date.now();

    return result;
  }

  /**
   * Calculate market momentum sentiment
   */
  calculateMarketMomentum() {
    // Simulated - would use actual S&P 500 / major index data
    const randomMomentum = (Math.random() - 0.5) * 0.8;
    return {
      score: randomMomentum,
      description: randomMomentum > 0 ? 'Markets trending up' : 'Markets trending down'
    };
  }

  /**
   * Calculate put/call ratio sentiment
   */
  calculatePutCallSentiment() {
    // Simulated put/call ratio (typically 0.7-1.3)
    const ratio = 0.8 + Math.random() * 0.4;
    // Low ratio = bullish, high ratio = bearish
    const score = (1 - ratio) * 2;
    return {
      score: Math.max(-1, Math.min(1, score)),
      ratio,
      description: ratio < 0.9 ? 'Low put/call (bullish)' : ratio > 1.1 ? 'High put/call (bearish)' : 'Normal'
    };
  }

  /**
   * Calculate VIX-based sentiment
   */
  calculateVixSentiment() {
    // Simulated VIX (typically 12-30)
    const vix = 15 + Math.random() * 15;
    // Low VIX = bullish/complacent, High VIX = fear
    const score = vix < 15 ? 0.5 : vix > 25 ? -0.5 : 0;
    return {
      score,
      vix,
      description: vix < 15 ? 'Low volatility (complacent)' : vix > 25 ? 'High volatility (fear)' : 'Normal volatility'
    };
  }

  /**
   * Calculate market breadth sentiment
   */
  calculateMarketBreadth() {
    // Simulated advance/decline ratio
    const advanceDecline = 0.5 + Math.random() * 1;
    const score = (advanceDecline - 1) * 1.5;
    return {
      score: Math.max(-1, Math.min(1, score)),
      advanceDecline,
      description: advanceDecline > 1.2 ? 'Broad market strength' : advanceDecline < 0.8 ? 'Broad market weakness' : 'Mixed'
    };
  }

  /**
   * Calculate safe haven demand
   */
  calculateSafeHavenDemand() {
    // Simulated - would look at gold, bonds, USD strength
    const score = (Math.random() - 0.5) * 0.6;
    return {
      score,
      description: score < -0.2 ? 'Flight to safety' : score > 0.2 ? 'Risk-on sentiment' : 'Normal'
    };
  }

  /**
   * Get technical indicator sentiment
   */
  async getTechnicalSentiment(symbol) {
    // This would integrate with the technical indicators module
    // Simplified version using random data
    const indicators = {
      rsi: 30 + Math.random() * 40, // 30-70
      macd: (Math.random() - 0.5) * 2,
      trend: Math.random() > 0.5 ? 'up' : 'down'
    };

    let score = 0;

    // RSI contribution
    if (indicators.rsi < 30) score -= 0.3; // Oversold = potentially bullish reversal
    else if (indicators.rsi > 70) score += 0.3; // Overbought = potentially bearish reversal
    else score += (indicators.rsi - 50) / 100;

    // MACD contribution
    score += indicators.macd * 0.3;

    // Trend contribution
    score += indicators.trend === 'up' ? 0.2 : -0.2;

    return {
      score: Math.max(-1, Math.min(1, score)),
      confidence: 0.6,
      source: 'technical',
      indicators
    };
  }

  /**
   * Get trading recommendation based on sentiment
   */
  getRecommendation(score, contrarianSignal) {
    if (contrarianSignal) {
      return {
        action: contrarianSignal.direction === 'bullish' ? 'BUY' : 'SELL',
        type: 'CONTRARIAN',
        confidence: 0.6,
        reason: contrarianSignal.reason
      };
    }

    if (score >= this.config.bullishThreshold) {
      return {
        action: 'BUY',
        type: 'TREND',
        confidence: Math.min(0.5 + score * 0.3, 0.8),
        reason: 'Positive sentiment across sources'
      };
    }

    if (score <= this.config.bearishThreshold) {
      return {
        action: 'SELL',
        type: 'TREND',
        confidence: Math.min(0.5 + Math.abs(score) * 0.3, 0.8),
        reason: 'Negative sentiment across sources'
      };
    }

    return {
      action: 'HOLD',
      type: 'NEUTRAL',
      confidence: 0.5,
      reason: 'Mixed or neutral sentiment'
    };
  }

  /**
   * Store sentiment in database
   */
  async storeSentiment(sentiment) {
    try {
      await pool.query(
        `INSERT INTO sentiment_data (symbol, source, sentiment_score, volume, data, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          sentiment.symbol,
          'aggregated',
          sentiment.score,
          sentiment.sources.social?.mentions || 0,
          JSON.stringify(sentiment),
          new Date()
        ]
      );
    } catch (error) {
      // Table might not exist yet - that's okay
      console.warn('Could not store sentiment:', error.message);
    }
  }

  /**
   * Get sentiment history for a symbol
   */
  async getSentimentHistory(symbol, hours = 24) {
    try {
      const result = await pool.query(
        `SELECT sentiment_score, created_at, data
         FROM sentiment_data
         WHERE symbol = $1
         AND created_at > NOW() - INTERVAL '${hours} hours'
         ORDER BY created_at ASC`,
        [symbol]
      );

      return result.rows.map(row => ({
        score: parseFloat(row.sentiment_score),
        timestamp: row.created_at,
        data: row.data
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get sentiment for multiple symbols
   */
  async getBatchSentiment(symbols) {
    const results = await Promise.all(
      symbols.map(symbol => this.getSentiment(symbol))
    );

    // Sort by sentiment score
    const sorted = results.sort((a, b) => b.score - a.score);

    return {
      mostBullish: sorted.slice(0, 3),
      mostBearish: sorted.slice(-3).reverse(),
      all: results
    };
  }
}

// Export singleton
let instance = null;

module.exports = {
  getSentimentAnalysisService: (config) => {
    if (!instance) {
      instance = new SentimentAnalysisService(config);
    }
    return instance;
  },
  SentimentAnalysisService
};
