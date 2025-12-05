/**
 * Position Sizing Service
 * Calculates optimal position sizes using various methods:
 * - Kelly Criterion (optimal bet sizing)
 * - Fixed Fractional (% risk per trade)
 * - Volatility-Adjusted (ATR-based)
 * - Equal Weight
 */

const TechnicalIndicators = require('../strategies/technicalIndicators');

class PositionSizingService {
  constructor(config = {}) {
    // Default configuration
    this.config = {
      // Risk management
      maxPortfolioRisk: config.maxPortfolioRisk || 0.02, // Max 2% portfolio risk per trade
      maxPositionSize: config.maxPositionSize || 0.15, // Max 15% of portfolio in single position
      minPositionSize: config.minPositionSize || 0.02, // Min 2% of portfolio per trade
      maxOpenPositions: config.maxOpenPositions || 10, // Max concurrent positions

      // Kelly Criterion settings
      kellyFraction: config.kellyFraction || 0.25, // Use 25% of Kelly (fractional Kelly)
      defaultWinRate: config.defaultWinRate || 0.55, // Assumed win rate if no history
      defaultWinLossRatio: config.defaultWinLossRatio || 1.5, // Avg win / avg loss

      // Volatility settings
      atrPeriod: config.atrPeriod || 14,
      volatilityLookback: config.volatilityLookback || 20,

      // Correlation settings
      correlationThreshold: config.correlationThreshold || 0.7, // Reduce size if highly correlated
      correlationPenalty: config.correlationPenalty || 0.5 // 50% reduction for correlated assets
    };
  }

  /**
   * Calculate position size using the specified method
   * @param {Object} params - Position sizing parameters
   * @returns {Object} - { shares, dollarAmount, percentOfPortfolio, method, reasoning }
   */
  calculatePositionSize(params) {
    const {
      method = 'fixed-fractional',
      portfolioValue,
      currentPrice,
      stopLossPrice,
      priceHistory = [],
      winRate,
      avgWin,
      avgLoss,
      existingPositions = [],
      symbol
    } = params;

    // Validate inputs
    if (!portfolioValue || portfolioValue <= 0) {
      throw new Error('Invalid portfolio value');
    }
    if (!currentPrice || currentPrice <= 0) {
      throw new Error('Invalid current price');
    }

    let result;

    switch (method) {
      case 'kelly':
        result = this.kellyPosition(params);
        break;
      case 'fixed-fractional':
        result = this.fixedFractionalPosition(params);
        break;
      case 'volatility-adjusted':
        result = this.volatilityAdjustedPosition(params);
        break;
      case 'equal-weight':
        result = this.equalWeightPosition(params);
        break;
      default:
        result = this.fixedFractionalPosition(params);
    }

    // Apply position limits
    result = this.applyPositionLimits(result, portfolioValue, currentPrice, existingPositions, symbol);

    return result;
  }

  /**
   * Kelly Criterion position sizing
   * Optimal bet size: f* = (bp - q) / b
   * where b = win/loss ratio, p = win probability, q = 1-p
   */
  kellyPosition(params) {
    const {
      portfolioValue,
      currentPrice,
      winRate = this.config.defaultWinRate,
      avgWin = 1,
      avgLoss = 1
    } = params;

    // Calculate win/loss ratio
    const b = avgWin / Math.max(avgLoss, 0.01);
    const p = Math.min(Math.max(winRate, 0.01), 0.99); // Clamp between 1% and 99%
    const q = 1 - p;

    // Full Kelly formula
    const fullKelly = (b * p - q) / b;

    // Use fractional Kelly (safer)
    const kellyFraction = fullKelly * this.config.kellyFraction;

    // Don't bet if Kelly is negative (no edge)
    if (kellyFraction <= 0) {
      return {
        shares: 0,
        dollarAmount: 0,
        percentOfPortfolio: 0,
        method: 'kelly',
        reasoning: 'Kelly criterion negative - no edge detected',
        metrics: { fullKelly, kellyFraction, winRate: p, winLossRatio: b }
      };
    }

    const dollarAmount = portfolioValue * kellyFraction;
    const shares = Math.floor(dollarAmount / currentPrice);

    return {
      shares,
      dollarAmount: shares * currentPrice,
      percentOfPortfolio: (shares * currentPrice) / portfolioValue,
      method: 'kelly',
      reasoning: `Kelly suggests ${(kellyFraction * 100).toFixed(1)}% based on ${(p * 100).toFixed(0)}% win rate and ${b.toFixed(2)} reward ratio`,
      metrics: { fullKelly, kellyFraction, winRate: p, winLossRatio: b }
    };
  }

  /**
   * Fixed Fractional position sizing
   * Risk a fixed % of portfolio per trade
   */
  fixedFractionalPosition(params) {
    const {
      portfolioValue,
      currentPrice,
      stopLossPrice,
      riskPercent = this.config.maxPortfolioRisk
    } = params;

    // If stop loss provided, calculate based on risk
    if (stopLossPrice && stopLossPrice > 0) {
      const riskPerShare = Math.abs(currentPrice - stopLossPrice);
      const dollarRisk = portfolioValue * riskPercent;
      const shares = Math.floor(dollarRisk / riskPerShare);
      const dollarAmount = shares * currentPrice;

      return {
        shares,
        dollarAmount,
        percentOfPortfolio: dollarAmount / portfolioValue,
        method: 'fixed-fractional',
        reasoning: `Risking ${(riskPercent * 100).toFixed(1)}% ($${dollarRisk.toFixed(0)}) with stop at $${stopLossPrice.toFixed(2)}`,
        metrics: { riskPercent, riskPerShare, dollarRisk, stopDistance: riskPerShare / currentPrice }
      };
    }

    // Without stop loss, use default position size
    const defaultSize = 0.05; // 5% of portfolio
    const dollarAmount = portfolioValue * defaultSize;
    const shares = Math.floor(dollarAmount / currentPrice);

    return {
      shares,
      dollarAmount: shares * currentPrice,
      percentOfPortfolio: defaultSize,
      method: 'fixed-fractional',
      reasoning: `Default ${(defaultSize * 100).toFixed(0)}% position (no stop loss provided)`,
      metrics: { defaultSize }
    };
  }

  /**
   * Volatility-adjusted position sizing
   * Smaller positions in volatile stocks, larger in stable ones
   */
  volatilityAdjustedPosition(params) {
    const {
      portfolioValue,
      currentPrice,
      priceHistory = [],
      targetVolatility = 0.02 // Target 2% daily volatility contribution
    } = params;

    if (priceHistory.length < this.config.volatilityLookback) {
      // Fall back to fixed fractional if not enough history
      return this.fixedFractionalPosition(params);
    }

    // Calculate historical volatility (standard deviation of returns)
    const returns = [];
    for (let i = 1; i < priceHistory.length; i++) {
      returns.push((priceHistory[i] - priceHistory[i - 1]) / priceHistory[i - 1]);
    }

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);

    // Adjust position size inversely to volatility
    // Higher volatility = smaller position
    const volatilityRatio = targetVolatility / Math.max(volatility, 0.001);
    const adjustedSize = Math.min(volatilityRatio * 0.05, this.config.maxPositionSize);

    const dollarAmount = portfolioValue * adjustedSize;
    const shares = Math.floor(dollarAmount / currentPrice);

    return {
      shares,
      dollarAmount: shares * currentPrice,
      percentOfPortfolio: adjustedSize,
      method: 'volatility-adjusted',
      reasoning: `Volatility ${(volatility * 100).toFixed(2)}% → ${(adjustedSize * 100).toFixed(1)}% position`,
      metrics: { volatility, targetVolatility, volatilityRatio, adjustedSize }
    };
  }

  /**
   * Equal weight position sizing
   * Divide portfolio equally among max positions
   */
  equalWeightPosition(params) {
    const {
      portfolioValue,
      currentPrice,
      existingPositions = []
    } = params;

    const currentPositionCount = existingPositions.length;
    const availableSlots = this.config.maxOpenPositions - currentPositionCount;

    if (availableSlots <= 0) {
      return {
        shares: 0,
        dollarAmount: 0,
        percentOfPortfolio: 0,
        method: 'equal-weight',
        reasoning: 'Maximum positions reached',
        metrics: { currentPositionCount, maxPositions: this.config.maxOpenPositions }
      };
    }

    const equalWeight = 1 / this.config.maxOpenPositions;
    const dollarAmount = portfolioValue * equalWeight;
    const shares = Math.floor(dollarAmount / currentPrice);

    return {
      shares,
      dollarAmount: shares * currentPrice,
      percentOfPortfolio: equalWeight,
      method: 'equal-weight',
      reasoning: `Equal weight: ${(equalWeight * 100).toFixed(1)}% (1/${this.config.maxOpenPositions} of portfolio)`,
      metrics: { equalWeight, currentPositionCount, availableSlots }
    };
  }

  /**
   * Apply position limits and constraints
   */
  applyPositionLimits(result, portfolioValue, currentPrice, existingPositions, symbol) {
    // Check max position size
    if (result.percentOfPortfolio > this.config.maxPositionSize) {
      const cappedAmount = portfolioValue * this.config.maxPositionSize;
      result.shares = Math.floor(cappedAmount / currentPrice);
      result.dollarAmount = result.shares * currentPrice;
      result.percentOfPortfolio = this.config.maxPositionSize;
      result.reasoning += ` (capped at ${(this.config.maxPositionSize * 100).toFixed(0)}% max)`;
    }

    // Check min position size
    if (result.percentOfPortfolio < this.config.minPositionSize && result.shares > 0) {
      const minAmount = portfolioValue * this.config.minPositionSize;
      result.shares = Math.floor(minAmount / currentPrice);
      result.dollarAmount = result.shares * currentPrice;
      result.percentOfPortfolio = this.config.minPositionSize;
      result.reasoning += ` (raised to ${(this.config.minPositionSize * 100).toFixed(0)}% min)`;
    }

    // Check max open positions
    if (existingPositions.length >= this.config.maxOpenPositions) {
      result.shares = 0;
      result.dollarAmount = 0;
      result.percentOfPortfolio = 0;
      result.reasoning = `Max ${this.config.maxOpenPositions} positions reached`;
    }

    // Check if already have position in this symbol
    const existingPosition = existingPositions.find(p => p.symbol === symbol);
    if (existingPosition) {
      // Could add logic to increase/decrease position
      result.existingPosition = existingPosition;
    }

    return result;
  }

  /**
   * Calculate correlation-adjusted size
   * Reduces position if highly correlated with existing positions
   */
  calculateCorrelationAdjustment(symbol, existingPositions, priceHistories) {
    if (existingPositions.length === 0 || !priceHistories[symbol]) {
      return 1.0; // No adjustment
    }

    let maxCorrelation = 0;

    for (const position of existingPositions) {
      if (priceHistories[position.symbol]) {
        const correlation = this.calculateCorrelation(
          priceHistories[symbol],
          priceHistories[position.symbol]
        );
        maxCorrelation = Math.max(maxCorrelation, Math.abs(correlation));
      }
    }

    // Apply penalty if highly correlated
    if (maxCorrelation > this.config.correlationThreshold) {
      return 1 - (this.config.correlationPenalty * (maxCorrelation - this.config.correlationThreshold) / (1 - this.config.correlationThreshold));
    }

    return 1.0;
  }

  /**
   * Calculate Pearson correlation between two price series
   */
  calculateCorrelation(prices1, prices2) {
    const n = Math.min(prices1.length, prices2.length);
    if (n < 10) return 0;

    const slice1 = prices1.slice(-n);
    const slice2 = prices2.slice(-n);

    const mean1 = slice1.reduce((a, b) => a + b, 0) / n;
    const mean2 = slice2.reduce((a, b) => a + b, 0) / n;

    let num = 0;
    let denom1 = 0;
    let denom2 = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = slice1[i] - mean1;
      const diff2 = slice2[i] - mean2;
      num += diff1 * diff2;
      denom1 += diff1 * diff1;
      denom2 += diff2 * diff2;
    }

    const denom = Math.sqrt(denom1 * denom2);
    return denom === 0 ? 0 : num / denom;
  }

  /**
   * Recommend optimal sizing method based on available data
   */
  recommendMethod(params) {
    const { winRate, avgWin, avgLoss, priceHistory } = params;

    // If we have trade history, use Kelly
    if (winRate && avgWin && avgLoss) {
      return 'kelly';
    }

    // If we have price history, use volatility-adjusted
    if (priceHistory && priceHistory.length >= this.config.volatilityLookback) {
      return 'volatility-adjusted';
    }

    // Default to fixed fractional
    return 'fixed-fractional';
  }

  /**
   * Get sizing recommendation with explanation
   */
  getRecommendation(params) {
    const method = this.recommendMethod(params);
    const result = this.calculatePositionSize({ ...params, method });

    return {
      ...result,
      recommendedMethod: method,
      allMethods: {
        kelly: this.kellyPosition(params),
        fixedFractional: this.fixedFractionalPosition(params),
        volatilityAdjusted: this.volatilityAdjustedPosition(params),
        equalWeight: this.equalWeightPosition(params)
      }
    };
  }
}

// Export singleton
let instance = null;

module.exports = {
  getPositionSizingService: (config) => {
    if (!instance) {
      instance = new PositionSizingService(config);
    }
    return instance;
  },
  PositionSizingService
};
