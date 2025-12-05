/**
 * Portfolio Risk Service
 * Monitors and calculates portfolio-level risk metrics:
 * - Value at Risk (VaR)
 * - Maximum Drawdown
 * - Sharpe Ratio
 * - Beta (market correlation)
 * - Sector concentration
 */

const TechnicalIndicators = require('../strategies/technicalIndicators');

class PortfolioRiskService {
  constructor(config = {}) {
    this.config = {
      // Risk thresholds
      maxVaR: config.maxVaR || 0.05, // Max 5% daily VaR
      maxDrawdown: config.maxDrawdown || 0.15, // Max 15% drawdown before alerts
      maxSectorConcentration: config.maxSectorConcentration || 0.40, // Max 40% in one sector
      maxSinglePosition: config.maxSinglePosition || 0.20, // Max 20% in single position

      // VaR settings
      varConfidence: config.varConfidence || 0.95, // 95% confidence
      varLookback: config.varLookback || 252, // 1 year of trading days

      // Sharpe settings
      riskFreeRate: config.riskFreeRate || 0.05, // 5% annual risk-free rate
      sharpeWindow: config.sharpeWindow || 252, // 1 year

      // Alert thresholds
      varAlertThreshold: config.varAlertThreshold || 0.03, // Alert at 3% VaR
      drawdownAlertThreshold: config.drawdownAlertThreshold || 0.10, // Alert at 10% drawdown
      correlationAlertThreshold: config.correlationAlertThreshold || 0.8 // High correlation alert
    };

    // Track portfolio history for metrics
    this.equityHistory = [];
    this.peakEquity = 0;
    this.alerts = [];
  }

  /**
   * Calculate comprehensive portfolio risk metrics
   */
  calculateRiskMetrics(portfolio) {
    const {
      equity,
      positions,
      dailyReturns = [],
      benchmarkReturns = [],
      priceHistories = {}
    } = portfolio;

    const metrics = {
      timestamp: new Date(),
      equity,
      var95: this.calculateVaR(dailyReturns, 0.95),
      var99: this.calculateVaR(dailyReturns, 0.99),
      maxDrawdown: this.calculateMaxDrawdown(equity),
      currentDrawdown: this.calculateCurrentDrawdown(equity),
      sharpeRatio: this.calculateSharpeRatio(dailyReturns),
      sortinoRatio: this.calculateSortinoRatio(dailyReturns),
      beta: this.calculateBeta(dailyReturns, benchmarkReturns),
      alpha: this.calculateAlpha(dailyReturns, benchmarkReturns),
      positionConcentration: this.calculateConcentration(positions, equity),
      sectorExposure: this.calculateSectorExposure(positions, equity),
      correlationMatrix: this.calculateCorrelationMatrix(positions, priceHistories),
      riskScore: 0 // Calculated below
    };

    // Calculate overall risk score (0-100)
    metrics.riskScore = this.calculateRiskScore(metrics);

    // Check for alerts
    metrics.alerts = this.checkAlerts(metrics);

    return metrics;
  }

  /**
   * Calculate Value at Risk using historical simulation
   * VaR = Expected loss at given confidence level
   */
  calculateVaR(returns, confidence = 0.95) {
    if (returns.length < 20) {
      return { value: 0, method: 'insufficient data' };
    }

    // Sort returns ascending
    const sortedReturns = [...returns].sort((a, b) => a - b);

    // Find the return at the (1 - confidence) percentile
    const index = Math.floor(returns.length * (1 - confidence));
    const varReturn = sortedReturns[index];

    return {
      value: Math.abs(varReturn),
      percentage: Math.abs(varReturn) * 100,
      method: 'historical',
      confidence,
      worstReturn: sortedReturns[0],
      samples: returns.length
    };
  }

  /**
   * Calculate parametric VaR using normal distribution
   */
  calculateParametricVaR(returns, confidence = 0.95, equity = 100000) {
    if (returns.length < 20) {
      return { value: 0, method: 'insufficient data' };
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Z-score for confidence level
    const zScores = { 0.90: 1.28, 0.95: 1.65, 0.99: 2.33 };
    const z = zScores[confidence] || 1.65;

    const varReturn = mean - (z * stdDev);
    const varDollar = Math.abs(varReturn) * equity;

    return {
      value: Math.abs(varReturn),
      dollarAmount: varDollar,
      percentage: Math.abs(varReturn) * 100,
      method: 'parametric',
      confidence,
      mean,
      stdDev
    };
  }

  /**
   * Calculate Maximum Drawdown
   */
  calculateMaxDrawdown(currentEquity) {
    // Update equity history
    this.equityHistory.push({ equity: currentEquity, time: new Date() });

    // Update peak
    if (currentEquity > this.peakEquity) {
      this.peakEquity = currentEquity;
    }

    // Calculate historical max drawdown
    let maxDrawdown = 0;
    let peak = this.equityHistory[0]?.equity || currentEquity;

    for (const point of this.equityHistory) {
      if (point.equity > peak) {
        peak = point.equity;
      }
      const drawdown = (peak - point.equity) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      maxDrawdown,
      maxDrawdownPercent: maxDrawdown * 100,
      peakEquity: this.peakEquity,
      currentEquity,
      recoveryNeeded: this.peakEquity > currentEquity
        ? ((this.peakEquity / currentEquity) - 1) * 100
        : 0
    };
  }

  /**
   * Calculate current drawdown from peak
   */
  calculateCurrentDrawdown(currentEquity) {
    if (this.peakEquity === 0) {
      this.peakEquity = currentEquity;
    }

    const drawdown = (this.peakEquity - currentEquity) / this.peakEquity;
    return {
      drawdown: Math.max(0, drawdown),
      drawdownPercent: Math.max(0, drawdown) * 100,
      peakEquity: this.peakEquity,
      currentEquity
    };
  }

  /**
   * Calculate Sharpe Ratio
   * (Return - Risk-free rate) / Standard Deviation
   */
  calculateSharpeRatio(returns) {
    if (returns.length < 20) {
      return { value: 0, method: 'insufficient data' };
    }

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return { value: 0, method: 'zero volatility' };

    // Annualize (assuming daily returns)
    const annualizedReturn = avgReturn * 252;
    const annualizedStdDev = stdDev * Math.sqrt(252);
    const dailyRiskFreeRate = this.config.riskFreeRate / 252;

    const sharpe = (annualizedReturn - this.config.riskFreeRate) / annualizedStdDev;

    return {
      value: sharpe,
      annualizedReturn: annualizedReturn * 100,
      annualizedVolatility: annualizedStdDev * 100,
      riskFreeRate: this.config.riskFreeRate * 100,
      interpretation: this.interpretSharpe(sharpe)
    };
  }

  /**
   * Calculate Sortino Ratio (only penalizes downside volatility)
   */
  calculateSortinoRatio(returns) {
    if (returns.length < 20) {
      return { value: 0, method: 'insufficient data' };
    }

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

    // Only use negative returns for downside deviation
    const negativeReturns = returns.filter(r => r < 0);
    if (negativeReturns.length === 0) {
      return { value: Infinity, interpretation: 'No negative returns' };
    }

    const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / returns.length;
    const downsideDeviation = Math.sqrt(downsideVariance);

    if (downsideDeviation === 0) return { value: 0, method: 'zero downside' };

    const annualizedReturn = avgReturn * 252;
    const annualizedDownside = downsideDeviation * Math.sqrt(252);

    const sortino = (annualizedReturn - this.config.riskFreeRate) / annualizedDownside;

    return {
      value: sortino,
      annualizedReturn: annualizedReturn * 100,
      downsideDeviation: annualizedDownside * 100,
      interpretation: this.interpretSortino(sortino)
    };
  }

  /**
   * Calculate Beta (market sensitivity)
   */
  calculateBeta(portfolioReturns, benchmarkReturns) {
    if (portfolioReturns.length < 20 || benchmarkReturns.length < 20) {
      return { value: 1, method: 'insufficient data' };
    }

    const n = Math.min(portfolioReturns.length, benchmarkReturns.length);
    const pReturns = portfolioReturns.slice(-n);
    const bReturns = benchmarkReturns.slice(-n);

    const pMean = pReturns.reduce((a, b) => a + b, 0) / n;
    const bMean = bReturns.reduce((a, b) => a + b, 0) / n;

    let covariance = 0;
    let bVariance = 0;

    for (let i = 0; i < n; i++) {
      covariance += (pReturns[i] - pMean) * (bReturns[i] - bMean);
      bVariance += Math.pow(bReturns[i] - bMean, 2);
    }

    covariance /= n;
    bVariance /= n;

    if (bVariance === 0) return { value: 1, method: 'zero benchmark variance' };

    const beta = covariance / bVariance;

    return {
      value: beta,
      interpretation: this.interpretBeta(beta),
      covariance,
      benchmarkVariance: bVariance
    };
  }

  /**
   * Calculate Alpha (excess return over benchmark)
   */
  calculateAlpha(portfolioReturns, benchmarkReturns) {
    if (portfolioReturns.length < 20 || benchmarkReturns.length < 20) {
      return { value: 0, method: 'insufficient data' };
    }

    const beta = this.calculateBeta(portfolioReturns, benchmarkReturns).value;

    const pReturn = portfolioReturns.reduce((a, b) => a + b, 0) / portfolioReturns.length;
    const bReturn = benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length;

    // Alpha = Portfolio Return - (Risk-free + Beta * (Benchmark - Risk-free))
    const dailyRf = this.config.riskFreeRate / 252;
    const alpha = pReturn - (dailyRf + beta * (bReturn - dailyRf));

    // Annualize
    const annualizedAlpha = alpha * 252;

    return {
      value: annualizedAlpha,
      dailyAlpha: alpha,
      percentage: annualizedAlpha * 100,
      interpretation: annualizedAlpha > 0 ? 'Outperforming' : 'Underperforming'
    };
  }

  /**
   * Calculate position concentration
   */
  calculateConcentration(positions, equity) {
    if (!positions || positions.length === 0) {
      return { maxConcentration: 0, herfindahl: 0, positions: [] };
    }

    const positionWeights = positions.map(p => ({
      symbol: p.symbol,
      value: p.marketValue || (p.qty * p.currentPrice),
      weight: (p.marketValue || (p.qty * p.currentPrice)) / equity
    }));

    // Sort by weight descending
    positionWeights.sort((a, b) => b.weight - a.weight);

    // Calculate Herfindahl Index (concentration measure)
    const herfindahl = positionWeights.reduce((sum, p) => sum + Math.pow(p.weight, 2), 0);

    return {
      maxConcentration: positionWeights[0]?.weight || 0,
      maxConcentrationSymbol: positionWeights[0]?.symbol,
      top5Concentration: positionWeights.slice(0, 5).reduce((sum, p) => sum + p.weight, 0),
      herfindahl,
      effectivePositions: herfindahl > 0 ? 1 / herfindahl : 0,
      positions: positionWeights.slice(0, 10)
    };
  }

  /**
   * Calculate sector exposure
   */
  calculateSectorExposure(positions, equity) {
    // Sector mappings (simplified - in production would use actual sector data)
    const sectorMap = {
      'AAPL': 'Technology', 'MSFT': 'Technology', 'GOOGL': 'Technology', 'META': 'Technology',
      'NVDA': 'Technology', 'AMD': 'Technology', 'INTC': 'Technology',
      'AMZN': 'Consumer', 'TSLA': 'Consumer', 'WMT': 'Consumer', 'HD': 'Consumer',
      'JPM': 'Financial', 'BAC': 'Financial', 'GS': 'Financial', 'V': 'Financial',
      'JNJ': 'Healthcare', 'PFE': 'Healthcare', 'UNH': 'Healthcare', 'MRNA': 'Healthcare',
      'XOM': 'Energy', 'CVX': 'Energy', 'COP': 'Energy',
      'BA': 'Industrial', 'CAT': 'Industrial', 'GE': 'Industrial'
    };

    const sectorExposure = {};

    for (const position of positions) {
      const sector = sectorMap[position.symbol] || 'Other';
      const weight = (position.marketValue || (position.qty * position.currentPrice)) / equity;

      if (!sectorExposure[sector]) {
        sectorExposure[sector] = { weight: 0, positions: [] };
      }

      sectorExposure[sector].weight += weight;
      sectorExposure[sector].positions.push(position.symbol);
    }

    // Find max sector
    let maxSector = null;
    let maxWeight = 0;

    for (const [sector, data] of Object.entries(sectorExposure)) {
      if (data.weight > maxWeight) {
        maxWeight = data.weight;
        maxSector = sector;
      }
    }

    return {
      sectors: sectorExposure,
      maxSector,
      maxSectorWeight: maxWeight,
      isOverconcentrated: maxWeight > this.config.maxSectorConcentration
    };
  }

  /**
   * Calculate correlation matrix for positions
   */
  calculateCorrelationMatrix(positions, priceHistories) {
    const symbols = positions.map(p => p.symbol).filter(s => priceHistories[s]);
    const matrix = {};

    for (let i = 0; i < symbols.length; i++) {
      matrix[symbols[i]] = {};
      for (let j = 0; j < symbols.length; j++) {
        if (i === j) {
          matrix[symbols[i]][symbols[j]] = 1;
        } else if (j < i) {
          matrix[symbols[i]][symbols[j]] = matrix[symbols[j]][symbols[i]];
        } else {
          matrix[symbols[i]][symbols[j]] = this.calculateCorrelation(
            priceHistories[symbols[i]],
            priceHistories[symbols[j]]
          );
        }
      }
    }

    // Find highly correlated pairs
    const highCorrelations = [];
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const corr = matrix[symbols[i]][symbols[j]];
        if (Math.abs(corr) > this.config.correlationAlertThreshold) {
          highCorrelations.push({
            pair: [symbols[i], symbols[j]],
            correlation: corr
          });
        }
      }
    }

    return { matrix, highCorrelations };
  }

  /**
   * Calculate correlation between two price series
   */
  calculateCorrelation(prices1, prices2) {
    if (!prices1 || !prices2) return 0;

    const n = Math.min(prices1.length, prices2.length);
    if (n < 10) return 0;

    // Calculate returns
    const returns1 = [];
    const returns2 = [];

    for (let i = 1; i < n; i++) {
      returns1.push((prices1[i] - prices1[i - 1]) / prices1[i - 1]);
      returns2.push((prices2[i] - prices2[i - 1]) / prices2[i - 1]);
    }

    const mean1 = returns1.reduce((a, b) => a + b, 0) / returns1.length;
    const mean2 = returns2.reduce((a, b) => a + b, 0) / returns2.length;

    let num = 0, denom1 = 0, denom2 = 0;

    for (let i = 0; i < returns1.length; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;
      num += diff1 * diff2;
      denom1 += diff1 * diff1;
      denom2 += diff2 * diff2;
    }

    const denom = Math.sqrt(denom1 * denom2);
    return denom === 0 ? 0 : num / denom;
  }

  /**
   * Calculate overall risk score (0-100)
   */
  calculateRiskScore(metrics) {
    let score = 0;

    // VaR component (30 points)
    const varValue = metrics.var95?.value || 0;
    if (varValue < 0.02) score += 30;
    else if (varValue < 0.03) score += 20;
    else if (varValue < 0.05) score += 10;

    // Drawdown component (25 points)
    const dd = metrics.currentDrawdown?.drawdown || 0;
    if (dd < 0.05) score += 25;
    else if (dd < 0.10) score += 15;
    else if (dd < 0.15) score += 5;

    // Sharpe component (20 points)
    const sharpe = metrics.sharpeRatio?.value || 0;
    if (sharpe > 2) score += 20;
    else if (sharpe > 1) score += 15;
    else if (sharpe > 0.5) score += 10;
    else if (sharpe > 0) score += 5;

    // Concentration component (15 points)
    const concentration = metrics.positionConcentration?.maxConcentration || 0;
    if (concentration < 0.10) score += 15;
    else if (concentration < 0.15) score += 10;
    else if (concentration < 0.20) score += 5;

    // Sector exposure component (10 points)
    const sectorMax = metrics.sectorExposure?.maxSectorWeight || 0;
    if (sectorMax < 0.30) score += 10;
    else if (sectorMax < 0.40) score += 5;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Check for risk alerts
   */
  checkAlerts(metrics) {
    const alerts = [];

    // VaR alert
    if (metrics.var95?.value > this.config.varAlertThreshold) {
      alerts.push({
        type: 'VAR_HIGH',
        severity: 'warning',
        message: `VaR (95%) at ${(metrics.var95.value * 100).toFixed(2)}% exceeds ${(this.config.varAlertThreshold * 100)}% threshold`
      });
    }

    // Drawdown alert
    if (metrics.currentDrawdown?.drawdown > this.config.drawdownAlertThreshold) {
      alerts.push({
        type: 'DRAWDOWN_HIGH',
        severity: 'critical',
        message: `Current drawdown ${(metrics.currentDrawdown.drawdown * 100).toFixed(2)}% exceeds ${(this.config.drawdownAlertThreshold * 100)}% threshold`
      });
    }

    // Concentration alert
    if (metrics.positionConcentration?.maxConcentration > this.config.maxSinglePosition) {
      alerts.push({
        type: 'CONCENTRATION_HIGH',
        severity: 'warning',
        message: `${metrics.positionConcentration.maxConcentrationSymbol} at ${(metrics.positionConcentration.maxConcentration * 100).toFixed(1)}% exceeds max`
      });
    }

    // Sector concentration alert
    if (metrics.sectorExposure?.isOverconcentrated) {
      alerts.push({
        type: 'SECTOR_CONCENTRATED',
        severity: 'warning',
        message: `${metrics.sectorExposure.maxSector} sector at ${(metrics.sectorExposure.maxSectorWeight * 100).toFixed(1)}%`
      });
    }

    // High correlation alert
    if (metrics.correlationMatrix?.highCorrelations?.length > 0) {
      alerts.push({
        type: 'HIGH_CORRELATION',
        severity: 'info',
        message: `${metrics.correlationMatrix.highCorrelations.length} highly correlated position pairs detected`
      });
    }

    return alerts;
  }

  /**
   * Interpretation helpers
   */
  interpretSharpe(sharpe) {
    if (sharpe > 3) return 'Excellent';
    if (sharpe > 2) return 'Very Good';
    if (sharpe > 1) return 'Good';
    if (sharpe > 0.5) return 'Acceptable';
    if (sharpe > 0) return 'Poor';
    return 'Negative (losing money)';
  }

  interpretSortino(sortino) {
    if (sortino > 3) return 'Excellent downside management';
    if (sortino > 2) return 'Very Good';
    if (sortino > 1) return 'Good';
    return 'Needs improvement';
  }

  interpretBeta(beta) {
    if (beta > 1.5) return 'Very aggressive (150%+ market moves)';
    if (beta > 1) return 'Aggressive (amplifies market moves)';
    if (beta > 0.5) return 'Moderate';
    if (beta > 0) return 'Defensive (less volatile than market)';
    return 'Inverse (moves opposite to market)';
  }
}

// Export singleton
let instance = null;

module.exports = {
  getPortfolioRiskService: (config) => {
    if (!instance) {
      instance = new PortfolioRiskService(config);
    }
    return instance;
  },
  PortfolioRiskService
};
