/**
 * AI Learning Service
 * Tracks AI trading performance and generates insights for improvement
 * Features:
 * - Trade outcome tracking
 * - Performance analytics
 * - Pattern recognition
 * - Strategy optimization suggestions
 */

const pool = require('../db/database');

class AILearningService {
  constructor() {
    this.performanceCache = new Map();
    this.lastAnalysis = null;
  }

  /**
   * Record trade outcome for learning
   */
  async recordTradeOutcome(tradeData) {
    const {
      botId,
      symbol,
      side,
      entryPrice,
      exitPrice,
      qty,
      entryTime,
      exitTime,
      strategy,
      newsArticleId,
      reasoning,
      confidence,
      marketConditions
    } = tradeData;

    // Calculate performance metrics
    const pnl = side === 'buy'
      ? (exitPrice - entryPrice) * qty
      : (entryPrice - exitPrice) * qty;
    const pnlPercent = side === 'buy'
      ? (exitPrice - entryPrice) / entryPrice
      : (entryPrice - exitPrice) / entryPrice;
    const holdingTimeMs = new Date(exitTime) - new Date(entryTime);
    const holdingTimeHours = holdingTimeMs / (1000 * 60 * 60);
    const isWinner = pnl > 0;

    const outcome = {
      botId,
      symbol,
      side,
      entryPrice,
      exitPrice,
      qty,
      pnl,
      pnlPercent,
      holdingTimeHours,
      isWinner,
      entryTime,
      exitTime,
      strategy,
      newsArticleId,
      reasoning,
      confidence,
      marketConditions,
      recordedAt: new Date()
    };

    // Store in database
    try {
      await pool.query(
        `INSERT INTO ai_trade_outcomes
         (bot_id, symbol, side, entry_price, exit_price, qty, pnl, pnl_percent,
          holding_time_hours, is_winner, strategy, news_article_id, reasoning,
          confidence, market_conditions, entry_time, exit_time, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          outcome.botId, outcome.symbol, outcome.side, outcome.entryPrice,
          outcome.exitPrice, outcome.qty, outcome.pnl, outcome.pnlPercent,
          outcome.holdingTimeHours, outcome.isWinner, outcome.strategy,
          outcome.newsArticleId, outcome.reasoning, outcome.confidence,
          JSON.stringify(outcome.marketConditions), outcome.entryTime,
          outcome.exitTime, outcome.recordedAt
        ]
      );
    } catch (error) {
      // Table might not exist
      console.warn('Could not store trade outcome:', error.message);
    }

    // Update in-memory cache for quick access
    this.updatePerformanceCache(outcome);

    return outcome;
  }

  /**
   * Update performance cache
   */
  updatePerformanceCache(outcome) {
    const key = `${outcome.botId}_${outcome.strategy}`;
    let cache = this.performanceCache.get(key);

    if (!cache) {
      cache = {
        totalTrades: 0,
        winners: 0,
        losers: 0,
        totalPnl: 0,
        avgHoldingTime: 0,
        avgConfidence: 0,
        bySymbol: {},
        recentTrades: []
      };
    }

    cache.totalTrades++;
    if (outcome.isWinner) cache.winners++;
    else cache.losers++;
    cache.totalPnl += outcome.pnl;
    cache.avgHoldingTime = (cache.avgHoldingTime * (cache.totalTrades - 1) + outcome.holdingTimeHours) / cache.totalTrades;
    cache.avgConfidence = (cache.avgConfidence * (cache.totalTrades - 1) + outcome.confidence) / cache.totalTrades;

    // Track by symbol
    if (!cache.bySymbol[outcome.symbol]) {
      cache.bySymbol[outcome.symbol] = { trades: 0, wins: 0, pnl: 0 };
    }
    cache.bySymbol[outcome.symbol].trades++;
    if (outcome.isWinner) cache.bySymbol[outcome.symbol].wins++;
    cache.bySymbol[outcome.symbol].pnl += outcome.pnl;

    // Keep recent trades
    cache.recentTrades.unshift(outcome);
    if (cache.recentTrades.length > 100) cache.recentTrades.pop();

    this.performanceCache.set(key, cache);
  }

  /**
   * Get comprehensive performance analysis
   */
  async getPerformanceAnalysis(botId = null, strategy = null, timeframeDays = 30) {
    let query = `
      SELECT
        bot_id,
        strategy,
        symbol,
        side,
        pnl,
        pnl_percent,
        is_winner,
        holding_time_hours,
        confidence,
        market_conditions,
        entry_time,
        exit_time,
        reasoning
      FROM ai_trade_outcomes
      WHERE recorded_at > NOW() - INTERVAL '${timeframeDays} days'
    `;

    const params = [];
    if (botId) {
      params.push(botId);
      query += ` AND bot_id = $${params.length}`;
    }
    if (strategy) {
      params.push(strategy);
      query += ` AND strategy = $${params.length}`;
    }

    query += ' ORDER BY exit_time DESC';

    try {
      const result = await pool.query(query, params);
      const trades = result.rows;

      if (trades.length === 0) {
        return {
          message: 'No trade data available for analysis',
          recommendations: ['Start trading to generate performance data']
        };
      }

      return this.analyzeTradeData(trades);
    } catch (error) {
      console.error('Error getting performance analysis:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Analyze trade data and generate insights
   */
  analyzeTradeData(trades) {
    const analysis = {
      summary: this.calculateSummaryStats(trades),
      byStrategy: this.analyzeByStrategy(trades),
      bySymbol: this.analyzeBySymbol(trades),
      byTimeOfDay: this.analyzeByTimeOfDay(trades),
      byHoldingTime: this.analyzeByHoldingTime(trades),
      byConfidence: this.analyzeByConfidence(trades),
      patterns: this.identifyPatterns(trades),
      recommendations: []
    };

    // Generate recommendations based on analysis
    analysis.recommendations = this.generateRecommendations(analysis);

    return analysis;
  }

  /**
   * Calculate summary statistics
   */
  calculateSummaryStats(trades) {
    const totalTrades = trades.length;
    const winners = trades.filter(t => t.is_winner).length;
    const losers = totalTrades - winners;
    const winRate = totalTrades > 0 ? winners / totalTrades : 0;

    const totalPnl = trades.reduce((sum, t) => sum + parseFloat(t.pnl), 0);
    const avgPnl = totalTrades > 0 ? totalPnl / totalTrades : 0;

    const winningTrades = trades.filter(t => t.is_winner);
    const losingTrades = trades.filter(t => !t.is_winner);

    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + parseFloat(t.pnl), 0) / winningTrades.length
      : 0;
    const avgLoss = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + parseFloat(t.pnl), 0)) / losingTrades.length
      : 0;

    const profitFactor = avgLoss > 0 ? (avgWin * winners) / (avgLoss * losers) : Infinity;
    const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);

    const avgHoldingTime = trades.reduce((sum, t) => sum + parseFloat(t.holding_time_hours), 0) / totalTrades;
    const avgConfidence = trades.reduce((sum, t) => sum + (parseFloat(t.confidence) || 0), 0) / totalTrades;

    return {
      totalTrades,
      winners,
      losers,
      winRate: (winRate * 100).toFixed(1) + '%',
      winRateValue: winRate,
      totalPnl: totalPnl.toFixed(2),
      avgPnl: avgPnl.toFixed(2),
      avgWin: avgWin.toFixed(2),
      avgLoss: avgLoss.toFixed(2),
      profitFactor: profitFactor.toFixed(2),
      expectancy: expectancy.toFixed(2),
      avgHoldingTimeHours: avgHoldingTime.toFixed(1),
      avgConfidence: avgConfidence.toFixed(0)
    };
  }

  /**
   * Analyze performance by strategy
   */
  analyzeByStrategy(trades) {
    const byStrategy = {};

    for (const trade of trades) {
      const strategy = trade.strategy || 'unknown';
      if (!byStrategy[strategy]) {
        byStrategy[strategy] = { trades: [], wins: 0, pnl: 0 };
      }
      byStrategy[strategy].trades.push(trade);
      if (trade.is_winner) byStrategy[strategy].wins++;
      byStrategy[strategy].pnl += parseFloat(trade.pnl);
    }

    const result = {};
    for (const [strategy, data] of Object.entries(byStrategy)) {
      result[strategy] = {
        totalTrades: data.trades.length,
        winRate: ((data.wins / data.trades.length) * 100).toFixed(1) + '%',
        totalPnl: data.pnl.toFixed(2),
        avgPnl: (data.pnl / data.trades.length).toFixed(2)
      };
    }

    return result;
  }

  /**
   * Analyze performance by symbol
   */
  analyzeBySymbol(trades) {
    const bySymbol = {};

    for (const trade of trades) {
      if (!bySymbol[trade.symbol]) {
        bySymbol[trade.symbol] = { trades: 0, wins: 0, pnl: 0 };
      }
      bySymbol[trade.symbol].trades++;
      if (trade.is_winner) bySymbol[trade.symbol].wins++;
      bySymbol[trade.symbol].pnl += parseFloat(trade.pnl);
    }

    // Sort by performance
    const sorted = Object.entries(bySymbol)
      .map(([symbol, data]) => ({
        symbol,
        trades: data.trades,
        winRate: ((data.wins / data.trades) * 100).toFixed(1) + '%',
        winRateValue: data.wins / data.trades,
        pnl: data.pnl.toFixed(2)
      }))
      .sort((a, b) => parseFloat(b.pnl) - parseFloat(a.pnl));

    return {
      best: sorted.slice(0, 5),
      worst: sorted.slice(-5).reverse(),
      all: sorted
    };
  }

  /**
   * Analyze performance by time of day
   */
  analyzeByTimeOfDay(trades) {
    const byHour = {};

    for (const trade of trades) {
      const hour = new Date(trade.entry_time).getHours();
      if (!byHour[hour]) {
        byHour[hour] = { trades: 0, wins: 0, pnl: 0 };
      }
      byHour[hour].trades++;
      if (trade.is_winner) byHour[hour].wins++;
      byHour[hour].pnl += parseFloat(trade.pnl);
    }

    const result = {};
    for (const [hour, data] of Object.entries(byHour)) {
      result[`${hour}:00`] = {
        trades: data.trades,
        winRate: ((data.wins / data.trades) * 100).toFixed(1) + '%',
        avgPnl: (data.pnl / data.trades).toFixed(2)
      };
    }

    // Find best hours
    const sortedHours = Object.entries(result)
      .sort((a, b) => parseFloat(b[1].avgPnl) - parseFloat(a[1].avgPnl));

    return {
      byHour: result,
      bestHours: sortedHours.slice(0, 3).map(([h]) => h),
      worstHours: sortedHours.slice(-3).map(([h]) => h)
    };
  }

  /**
   * Analyze performance by holding time
   */
  analyzeByHoldingTime(trades) {
    const categories = {
      'under_1h': { trades: [], min: 0, max: 1 },
      '1h_to_4h': { trades: [], min: 1, max: 4 },
      '4h_to_24h': { trades: [], min: 4, max: 24 },
      'over_24h': { trades: [], min: 24, max: Infinity }
    };

    for (const trade of trades) {
      const hours = parseFloat(trade.holding_time_hours);
      for (const [cat, data] of Object.entries(categories)) {
        if (hours >= data.min && hours < data.max) {
          data.trades.push(trade);
          break;
        }
      }
    }

    const result = {};
    for (const [cat, data] of Object.entries(categories)) {
      if (data.trades.length > 0) {
        const wins = data.trades.filter(t => t.is_winner).length;
        const pnl = data.trades.reduce((sum, t) => sum + parseFloat(t.pnl), 0);
        result[cat] = {
          trades: data.trades.length,
          winRate: ((wins / data.trades.length) * 100).toFixed(1) + '%',
          avgPnl: (pnl / data.trades.length).toFixed(2)
        };
      }
    }

    return result;
  }

  /**
   * Analyze performance by confidence level
   */
  analyzeByConfidence(trades) {
    const categories = {
      'high_70_plus': { trades: [], min: 70, max: 101 },
      'medium_50_70': { trades: [], min: 50, max: 70 },
      'low_under_50': { trades: [], min: 0, max: 50 }
    };

    for (const trade of trades) {
      const conf = parseFloat(trade.confidence) || 50;
      for (const [cat, data] of Object.entries(categories)) {
        if (conf >= data.min && conf < data.max) {
          data.trades.push(trade);
          break;
        }
      }
    }

    const result = {};
    for (const [cat, data] of Object.entries(categories)) {
      if (data.trades.length > 0) {
        const wins = data.trades.filter(t => t.is_winner).length;
        const pnl = data.trades.reduce((sum, t) => sum + parseFloat(t.pnl), 0);
        result[cat] = {
          trades: data.trades.length,
          winRate: ((wins / data.trades.length) * 100).toFixed(1) + '%',
          avgPnl: (pnl / data.trades.length).toFixed(2)
        };
      }
    }

    // Check if high confidence trades perform better
    const highConf = result['high_70_plus'];
    const lowConf = result['low_under_50'];
    const confidenceWorks = highConf && lowConf &&
      parseFloat(highConf.avgPnl) > parseFloat(lowConf.avgPnl);

    return {
      byLevel: result,
      confidenceCorrelation: confidenceWorks ? 'positive' : 'weak_or_negative',
      recommendation: confidenceWorks
        ? 'High confidence trades perform better - consider raising minimum threshold'
        : 'Confidence score not predictive - may need recalibration'
    };
  }

  /**
   * Identify patterns in trade data
   */
  identifyPatterns(trades) {
    const patterns = [];

    // Check for consecutive losing streaks
    let maxLosingStreak = 0;
    let currentStreak = 0;
    for (const trade of trades) {
      if (!trade.is_winner) {
        currentStreak++;
        maxLosingStreak = Math.max(maxLosingStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    if (maxLosingStreak >= 5) {
      patterns.push({
        type: 'losing_streak',
        severity: 'warning',
        description: `Max losing streak of ${maxLosingStreak} trades detected`,
        recommendation: 'Consider adding circuit breaker to pause after consecutive losses'
      });
    }

    // Check for overtrading on single symbol
    const symbolCounts = {};
    for (const trade of trades) {
      symbolCounts[trade.symbol] = (symbolCounts[trade.symbol] || 0) + 1;
    }
    const maxSymbolTrades = Math.max(...Object.values(symbolCounts));
    if (maxSymbolTrades > trades.length * 0.4) {
      const topSymbol = Object.entries(symbolCounts)
        .sort((a, b) => b[1] - a[1])[0][0];
      patterns.push({
        type: 'concentration',
        severity: 'info',
        description: `${maxSymbolTrades} trades (${(maxSymbolTrades / trades.length * 100).toFixed(0)}%) on ${topSymbol}`,
        recommendation: 'Consider diversifying across more symbols'
      });
    }

    // Check if small wins, big losses pattern
    const winningTrades = trades.filter(t => t.is_winner);
    const losingTrades = trades.filter(t => !t.is_winner);
    if (winningTrades.length > 0 && losingTrades.length > 0) {
      const avgWin = Math.abs(winningTrades.reduce((sum, t) => sum + parseFloat(t.pnl), 0)) / winningTrades.length;
      const avgLoss = Math.abs(losingTrades.reduce((sum, t) => sum + parseFloat(t.pnl), 0)) / losingTrades.length;
      if (avgLoss > avgWin * 2) {
        patterns.push({
          type: 'asymmetric_risk',
          severity: 'warning',
          description: `Avg loss ($${avgLoss.toFixed(2)}) is ${(avgLoss / avgWin).toFixed(1)}x avg win ($${avgWin.toFixed(2)})`,
          recommendation: 'Tighten stop losses or use better risk management'
        });
      }
    }

    return patterns;
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations(analysis) {
    const recommendations = [];

    // Win rate recommendations
    const winRate = analysis.summary.winRateValue;
    if (winRate < 0.4) {
      recommendations.push({
        priority: 'high',
        category: 'win_rate',
        action: 'Improve entry criteria - current win rate is below 40%',
        details: 'Consider adding more filters or raising confidence thresholds'
      });
    }

    // Profit factor
    const pf = parseFloat(analysis.summary.profitFactor);
    if (pf < 1) {
      recommendations.push({
        priority: 'high',
        category: 'profitability',
        action: 'System is losing money (profit factor < 1)',
        details: 'Review exit strategy and stop loss placement'
      });
    } else if (pf < 1.5) {
      recommendations.push({
        priority: 'medium',
        category: 'profitability',
        action: 'Profit factor is marginal - aim for > 1.5',
        details: 'Look for ways to increase average win or decrease average loss'
      });
    }

    // Confidence calibration
    if (analysis.byConfidence.confidenceCorrelation === 'weak_or_negative') {
      recommendations.push({
        priority: 'medium',
        category: 'ai_calibration',
        action: 'AI confidence scores not predictive of success',
        details: 'Consider retraining or adjusting the AI prompt'
      });
    }

    // Best performing strategy
    const strategies = Object.entries(analysis.byStrategy);
    if (strategies.length > 1) {
      const sorted = strategies.sort((a, b) => parseFloat(b[1].totalPnl) - parseFloat(a[1].totalPnl));
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];

      if (parseFloat(best[1].totalPnl) > 0 && parseFloat(worst[1].totalPnl) < 0) {
        recommendations.push({
          priority: 'low',
          category: 'strategy',
          action: `Focus more on ${best[0]} strategy`,
          details: `${best[0]} has positive P&L while ${worst[0]} is losing money`
        });
      }
    }

    // Add pattern-based recommendations
    for (const pattern of analysis.patterns) {
      if (pattern.severity === 'warning') {
        recommendations.push({
          priority: 'medium',
          category: pattern.type,
          action: pattern.recommendation,
          details: pattern.description
        });
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations;
  }

  /**
   * Generate weekly learning report
   */
  async generateWeeklyReport(botId = null) {
    const analysis = await this.getPerformanceAnalysis(botId, null, 7);

    if (analysis.error || analysis.message) {
      return analysis;
    }

    return {
      period: 'Last 7 days',
      generatedAt: new Date(),
      summary: analysis.summary,
      topInsights: [
        `Win rate: ${analysis.summary.winRate}`,
        `Profit factor: ${analysis.summary.profitFactor}`,
        `Best symbol: ${analysis.bySymbol.best[0]?.symbol || 'N/A'}`,
        `Patterns found: ${analysis.patterns.length}`
      ],
      recommendations: analysis.recommendations.slice(0, 5),
      fullAnalysis: analysis
    };
  }
}

// Export singleton
let instance = null;

module.exports = {
  getAILearningService: () => {
    if (!instance) {
      instance = new AILearningService();
    }
    return instance;
  },
  AILearningService
};
