/**
 * VWAP (Volume-Weighted Average Price) Strategy
 *
 * Theory: VWAP represents the average price weighted by volume throughout the day.
 * Institutional traders use VWAP as a benchmark. Price tends to revert to VWAP.
 *
 * Entry Logic:
 * - BUY when price is 1%+ below VWAP with increasing volume (mean reversion expected)
 * - SELL when price is 1%+ above VWAP with decreasing momentum
 *
 * Best for: Intraday trading, mean reversion plays
 */

const TechnicalIndicators = require('./technicalIndicators');

class VWAPStrategy {
  constructor(config = {}) {
    this.name = 'VWAP Strategy';
    this.description = 'Trades mean reversion to VWAP with volume confirmation';

    // Configuration with defaults
    this.config = {
      vwapDeviation: config.vwapDeviation || 0.01, // 1% deviation from VWAP
      volumeThreshold: config.volumeThreshold || 1.2, // 1.2x average volume
      profitTarget: config.profitTarget || 0.02, // 2% profit target
      stopLoss: config.stopLoss || 0.015, // 1.5% stop loss
      positionSize: config.positionSize || 0.1, // 10% of portfolio
      minBarsRequired: config.minBarsRequired || 10 // Minimum bars for VWAP calculation
    };
  }

  /**
   * Analyze market data and generate trading signals
   * @param {Object} data - Market data object
   * @returns {Object} - Signal object { action, reason, confidence, targets }
   */
  analyze(data) {
    const { bars, currentPrice, volume, avgVolume, position } = data;

    // Validate data
    if (!bars || bars.length < this.config.minBarsRequired) {
      return { action: 'HOLD', reason: 'Insufficient data for VWAP calculation', confidence: 0 };
    }

    // Calculate VWAP
    const vwap = TechnicalIndicators.VWAP(bars);
    if (!vwap) {
      return { action: 'HOLD', reason: 'Unable to calculate VWAP', confidence: 0 };
    }

    // Calculate deviation from VWAP
    const deviation = (currentPrice - vwap) / vwap;
    const volumeRatio = volume / avgVolume;

    // Get trend context
    const closes = bars.map(b => b.close);
    const trend = TechnicalIndicators.TrendDirection(closes, 10, 20);

    // Entry signals
    if (!position) {
      // BUY Signal: Price significantly below VWAP with volume
      if (deviation < -this.config.vwapDeviation && volumeRatio > this.config.volumeThreshold) {
        const confidence = this.calculateConfidence(deviation, volumeRatio, trend, 'BUY');

        return {
          action: 'BUY',
          reason: `Price ${(Math.abs(deviation) * 100).toFixed(2)}% below VWAP with ${volumeRatio.toFixed(1)}x volume`,
          confidence,
          targets: {
            entry: currentPrice,
            profitTarget: vwap * (1 + this.config.profitTarget * 0.5), // Target halfway to profit above VWAP
            stopLoss: currentPrice * (1 - this.config.stopLoss)
          },
          indicators: { vwap, deviation, volumeRatio, trend }
        };
      }

      // SHORT Signal: Price significantly above VWAP (if shorting enabled)
      if (deviation > this.config.vwapDeviation && volumeRatio < 0.8) {
        const confidence = this.calculateConfidence(deviation, volumeRatio, trend, 'SELL');

        return {
          action: 'SELL_SHORT',
          reason: `Price ${(deviation * 100).toFixed(2)}% above VWAP with declining volume`,
          confidence,
          targets: {
            entry: currentPrice,
            profitTarget: vwap * (1 - this.config.profitTarget * 0.5),
            stopLoss: currentPrice * (1 + this.config.stopLoss)
          },
          indicators: { vwap, deviation, volumeRatio, trend }
        };
      }
    }

    // Exit signals for existing positions
    if (position) {
      const positionSide = position.side;
      const entryPrice = position.entryPrice;
      const pnlPercent = positionSide === 'long'
        ? (currentPrice - entryPrice) / entryPrice
        : (entryPrice - currentPrice) / entryPrice;

      // Take profit at VWAP or profit target
      if (positionSide === 'long') {
        if (currentPrice >= vwap || pnlPercent >= this.config.profitTarget) {
          return {
            action: 'SELL',
            reason: `Taking profit: ${(pnlPercent * 100).toFixed(2)}% gain, price at/above VWAP`,
            confidence: 85,
            targets: { exitPrice: currentPrice },
            indicators: { vwap, pnlPercent }
          };
        }

        // Stop loss
        if (pnlPercent <= -this.config.stopLoss) {
          return {
            action: 'SELL',
            reason: `Stop loss triggered: ${(pnlPercent * 100).toFixed(2)}% loss`,
            confidence: 95,
            targets: { exitPrice: currentPrice },
            indicators: { vwap, pnlPercent }
          };
        }
      }

      // Short position exits
      if (positionSide === 'short') {
        if (currentPrice <= vwap || pnlPercent >= this.config.profitTarget) {
          return {
            action: 'BUY_TO_COVER',
            reason: `Taking profit on short: ${(pnlPercent * 100).toFixed(2)}% gain`,
            confidence: 85,
            targets: { exitPrice: currentPrice },
            indicators: { vwap, pnlPercent }
          };
        }

        if (pnlPercent <= -this.config.stopLoss) {
          return {
            action: 'BUY_TO_COVER',
            reason: `Stop loss on short: ${(pnlPercent * 100).toFixed(2)}% loss`,
            confidence: 95,
            targets: { exitPrice: currentPrice },
            indicators: { vwap, pnlPercent }
          };
        }
      }
    }

    return {
      action: 'HOLD',
      reason: 'No clear signal - price near VWAP',
      confidence: 0,
      indicators: { vwap, deviation, volumeRatio, trend }
    };
  }

  /**
   * Calculate confidence score for a signal
   */
  calculateConfidence(deviation, volumeRatio, trend, action) {
    let confidence = 50;

    // Deviation strength (more deviation = higher confidence in mean reversion)
    const absDeviation = Math.abs(deviation);
    if (absDeviation > 0.02) confidence += 15;
    else if (absDeviation > 0.015) confidence += 10;
    else confidence += 5;

    // Volume confirmation
    if (volumeRatio > 1.5) confidence += 15;
    else if (volumeRatio > 1.2) confidence += 10;
    else confidence += 5;

    // Trend alignment (counter-trend gets lower confidence)
    if (action === 'BUY' && trend === 'bullish') confidence += 10;
    if (action === 'SELL' && trend === 'bearish') confidence += 10;
    if ((action === 'BUY' && trend === 'bearish') || (action === 'SELL' && trend === 'bullish')) {
      confidence -= 10;
    }

    return Math.min(95, Math.max(0, confidence));
  }

  /**
   * Check entry conditions (simplified interface for trading bot)
   */
  checkEntry(priceHistory, volumeHistory, currentPrice, avgVolume) {
    const bars = this.createBarsFromArrays(priceHistory, volumeHistory);
    const volume = volumeHistory[volumeHistory.length - 1] || avgVolume;

    const signal = this.analyze({
      bars,
      currentPrice,
      volume,
      avgVolume,
      position: null
    });

    return {
      shouldEnter: signal.action === 'BUY' && signal.confidence >= 60,
      reason: signal.reason,
      confidence: signal.confidence,
      targets: signal.targets
    };
  }

  /**
   * Check exit conditions
   */
  checkExit(priceHistory, volumeHistory, currentPrice, avgVolume, position) {
    const bars = this.createBarsFromArrays(priceHistory, volumeHistory);
    const volume = volumeHistory[volumeHistory.length - 1] || avgVolume;

    const signal = this.analyze({
      bars,
      currentPrice,
      volume,
      avgVolume,
      position
    });

    return {
      shouldExit: signal.action === 'SELL' || signal.action === 'BUY_TO_COVER',
      reason: signal.reason,
      confidence: signal.confidence
    };
  }

  /**
   * Helper to create bars from price/volume arrays
   */
  createBarsFromArrays(prices, volumes) {
    const bars = [];
    for (let i = 0; i < prices.length; i++) {
      bars.push({
        high: prices[i] * 1.001, // Estimate high
        low: prices[i] * 0.999, // Estimate low
        close: prices[i],
        volume: volumes[i] || 1000000
      });
    }
    return bars;
  }
}

module.exports = VWAPStrategy;
