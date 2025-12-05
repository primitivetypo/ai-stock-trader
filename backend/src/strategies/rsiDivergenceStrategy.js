/**
 * RSI Divergence Strategy
 *
 * Theory: Divergence between price and RSI indicates weakening momentum.
 * - Bullish divergence: Price makes lower low, RSI makes higher low (reversal up)
 * - Bearish divergence: Price makes higher high, RSI makes lower high (reversal down)
 *
 * Entry Logic:
 * - Detect divergence pattern over lookback period
 * - Wait for confirmation (price breaking trend)
 * - Enter in direction of expected reversal
 *
 * Best for: Catching trend reversals at exhaustion points
 */

const TechnicalIndicators = require('./technicalIndicators');

class RSIDivergenceStrategy {
  constructor(config = {}) {
    this.name = 'RSI Divergence Strategy';
    this.description = 'Trades RSI divergence patterns for trend reversals';

    // Configuration with defaults
    this.config = {
      rsiPeriod: config.rsiPeriod || 14,
      divergenceLookback: config.divergenceLookback || 20,
      rsiOversold: config.rsiOversold || 35,
      rsiOverbought: config.rsiOverbought || 65,
      minDivergenceStrength: config.minDivergenceStrength || 2, // Min RSI divergence points
      profitTarget: config.profitTarget || 0.035, // 3.5% profit target
      stopLoss: config.stopLoss || 0.02, // 2% stop loss
      positionSize: config.positionSize || 0.1, // 10% of portfolio
      requireConfirmation: config.requireConfirmation !== false // Wait for price confirmation
    };
  }

  /**
   * Analyze market data and generate trading signals
   */
  analyze(data) {
    const { prices, currentPrice, position } = data;

    // Validate data
    if (!prices || prices.length < this.config.rsiPeriod + this.config.divergenceLookback) {
      return { action: 'HOLD', reason: 'Insufficient data for divergence analysis', confidence: 0 };
    }

    // Calculate RSI values
    const rsiValues = TechnicalIndicators.RSIArray(prices, this.config.rsiPeriod);
    const currentRSI = rsiValues[rsiValues.length - 1];

    // Detect divergence
    const divergence = this.detectDivergence(prices, rsiValues);

    // Get support/resistance levels
    const support = TechnicalIndicators.Support(prices);
    const resistance = TechnicalIndicators.Resistance(prices);

    // Entry signals
    if (!position) {
      // Bullish divergence - BUY signal
      if (divergence.bullish && divergence.strength >= this.config.minDivergenceStrength) {
        // Check if RSI is in oversold territory (adds conviction)
        const isOversold = currentRSI < this.config.rsiOversold;

        // Check for confirmation (price starting to rise)
        const confirmed = this.checkConfirmation(prices, 'bullish');

        if (!this.config.requireConfirmation || confirmed) {
          const confidence = this.calculateConfidence(divergence, currentRSI, isOversold, confirmed);

          return {
            action: 'BUY',
            reason: `Bullish RSI divergence detected (strength: ${divergence.strength.toFixed(1)}), RSI: ${currentRSI.toFixed(0)}${isOversold ? ' (oversold)' : ''}`,
            confidence,
            targets: {
              entry: currentPrice,
              profitTarget: Math.min(resistance, currentPrice * (1 + this.config.profitTarget)),
              stopLoss: Math.max(support * 0.98, currentPrice * (1 - this.config.stopLoss))
            },
            indicators: {
              rsi: currentRSI,
              divergenceType: 'bullish',
              divergenceStrength: divergence.strength,
              support,
              resistance,
              confirmed
            }
          };
        }
      }

      // Bearish divergence - SELL signal
      if (divergence.bearish && divergence.strength >= this.config.minDivergenceStrength) {
        const isOverbought = currentRSI > this.config.rsiOverbought;
        const confirmed = this.checkConfirmation(prices, 'bearish');

        if (!this.config.requireConfirmation || confirmed) {
          const confidence = this.calculateConfidence(divergence, currentRSI, isOverbought, confirmed);

          return {
            action: 'SELL_SHORT',
            reason: `Bearish RSI divergence detected (strength: ${divergence.strength.toFixed(1)}), RSI: ${currentRSI.toFixed(0)}${isOverbought ? ' (overbought)' : ''}`,
            confidence,
            targets: {
              entry: currentPrice,
              profitTarget: Math.max(support, currentPrice * (1 - this.config.profitTarget)),
              stopLoss: Math.min(resistance * 1.02, currentPrice * (1 + this.config.stopLoss))
            },
            indicators: {
              rsi: currentRSI,
              divergenceType: 'bearish',
              divergenceStrength: divergence.strength,
              support,
              resistance,
              confirmed
            }
          };
        }
      }
    }

    // Exit signals
    if (position) {
      const entryPrice = position.entryPrice;
      const positionSide = position.side;

      if (positionSide === 'long') {
        const pnlPercent = (currentPrice - entryPrice) / entryPrice;

        // Take profit at overbought or target
        if (currentRSI > 70 || pnlPercent >= this.config.profitTarget) {
          return {
            action: 'SELL',
            reason: `Taking profit: ${(pnlPercent * 100).toFixed(2)}%, RSI: ${currentRSI.toFixed(0)}`,
            confidence: 85,
            indicators: { rsi: currentRSI, pnlPercent }
          };
        }

        // Exit on bearish divergence forming
        if (divergence.bearish && pnlPercent > 0.01) {
          return {
            action: 'SELL',
            reason: 'Bearish divergence forming, taking profit',
            confidence: 75,
            indicators: { rsi: currentRSI, pnlPercent, divergence: 'bearish' }
          };
        }

        // Stop loss
        if (pnlPercent <= -this.config.stopLoss) {
          return {
            action: 'SELL',
            reason: `Stop loss triggered: ${(pnlPercent * 100).toFixed(2)}%`,
            confidence: 95,
            indicators: { pnlPercent }
          };
        }
      }

      if (positionSide === 'short') {
        const pnlPercent = (entryPrice - currentPrice) / entryPrice;

        // Take profit at oversold or target
        if (currentRSI < 30 || pnlPercent >= this.config.profitTarget) {
          return {
            action: 'BUY_TO_COVER',
            reason: `Taking profit on short: ${(pnlPercent * 100).toFixed(2)}%, RSI: ${currentRSI.toFixed(0)}`,
            confidence: 85,
            indicators: { rsi: currentRSI, pnlPercent }
          };
        }

        // Exit on bullish divergence
        if (divergence.bullish && pnlPercent > 0.01) {
          return {
            action: 'BUY_TO_COVER',
            reason: 'Bullish divergence forming, taking profit on short',
            confidence: 75,
            indicators: { rsi: currentRSI, pnlPercent }
          };
        }

        // Stop loss
        if (pnlPercent <= -this.config.stopLoss) {
          return {
            action: 'BUY_TO_COVER',
            reason: `Stop loss on short: ${(pnlPercent * 100).toFixed(2)}%`,
            confidence: 95,
            indicators: { pnlPercent }
          };
        }
      }
    }

    return {
      action: 'HOLD',
      reason: divergence.bullish || divergence.bearish
        ? `Divergence detected but awaiting confirmation`
        : 'No divergence pattern detected',
      confidence: 0,
      indicators: {
        rsi: currentRSI,
        divergence: divergence.bullish ? 'bullish' : divergence.bearish ? 'bearish' : 'none',
        strength: divergence.strength
      }
    };
  }

  /**
   * Detect RSI divergence patterns
   */
  detectDivergence(prices, rsiValues) {
    const lookback = this.config.divergenceLookback;
    const recentPrices = prices.slice(-lookback);
    const recentRSI = rsiValues.slice(-lookback);

    if (recentPrices.length < lookback || recentRSI.length < lookback) {
      return { bullish: false, bearish: false, strength: 0 };
    }

    // Find swing points in first half and second half of lookback
    const halfPoint = Math.floor(lookback / 2);

    // First half analysis
    const firstHalfPrices = recentPrices.slice(0, halfPoint);
    const firstHalfRSI = recentRSI.slice(0, halfPoint);

    // Second half analysis
    const secondHalfPrices = recentPrices.slice(halfPoint);
    const secondHalfRSI = recentRSI.slice(halfPoint);

    // Find lows for bullish divergence
    const firstLowPrice = Math.min(...firstHalfPrices);
    const secondLowPrice = Math.min(...secondHalfPrices);
    const firstLowRSI = Math.min(...firstHalfRSI);
    const secondLowRSI = Math.min(...secondHalfRSI);

    // Find highs for bearish divergence
    const firstHighPrice = Math.max(...firstHalfPrices);
    const secondHighPrice = Math.max(...secondHalfPrices);
    const firstHighRSI = Math.max(...firstHalfRSI);
    const secondHighRSI = Math.max(...secondHalfRSI);

    // Bullish divergence: Price lower low, RSI higher low
    const pricePercentChange = (secondLowPrice - firstLowPrice) / firstLowPrice * 100;
    const rsiChange = secondLowRSI - firstLowRSI;
    const bullish = pricePercentChange < -0.5 && rsiChange > 0;
    const bullishStrength = bullish ? Math.abs(rsiChange) : 0;

    // Bearish divergence: Price higher high, RSI lower high
    const pricePercentChangeHigh = (secondHighPrice - firstHighPrice) / firstHighPrice * 100;
    const rsiChangeHigh = secondHighRSI - firstHighRSI;
    const bearish = pricePercentChangeHigh > 0.5 && rsiChangeHigh < 0;
    const bearishStrength = bearish ? Math.abs(rsiChangeHigh) : 0;

    return {
      bullish,
      bearish,
      strength: Math.max(bullishStrength, bearishStrength),
      details: {
        priceChange: bullish ? pricePercentChange : pricePercentChangeHigh,
        rsiChange: bullish ? rsiChange : rsiChangeHigh
      }
    };
  }

  /**
   * Check for price confirmation of divergence
   */
  checkConfirmation(prices, direction) {
    if (prices.length < 5) return false;

    const recent = prices.slice(-5);
    const prevPrice = recent[0];
    const currentPrice = recent[recent.length - 1];

    if (direction === 'bullish') {
      // Price should be rising from recent low
      const recentLow = Math.min(...recent.slice(0, 3));
      return currentPrice > recentLow * 1.005;
    }

    if (direction === 'bearish') {
      // Price should be falling from recent high
      const recentHigh = Math.max(...recent.slice(0, 3));
      return currentPrice < recentHigh * 0.995;
    }

    return false;
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(divergence, rsi, isExtreme, confirmed) {
    let confidence = 45;

    // Divergence strength
    if (divergence.strength > 5) confidence += 20;
    else if (divergence.strength > 3) confidence += 15;
    else if (divergence.strength > 2) confidence += 10;

    // RSI in extreme territory
    if (isExtreme) confidence += 15;

    // Price confirmation
    if (confirmed) confidence += 15;

    // RSI level adds context
    if ((divergence.bullish && rsi < 30) || (divergence.bearish && rsi > 70)) {
      confidence += 10;
    }

    return Math.min(95, Math.max(0, confidence));
  }

  /**
   * Simplified interface for trading bot
   */
  checkEntry(priceHistory, volumeHistory, currentPrice) {
    const signal = this.analyze({
      prices: priceHistory,
      currentPrice,
      position: null
    });

    return {
      shouldEnter: signal.action === 'BUY' && signal.confidence >= 65,
      reason: signal.reason,
      confidence: signal.confidence,
      targets: signal.targets
    };
  }

  /**
   * Check exit conditions
   */
  checkExit(priceHistory, volumeHistory, currentPrice, position) {
    const signal = this.analyze({
      prices: priceHistory,
      currentPrice,
      position
    });

    return {
      shouldExit: signal.action === 'SELL' || signal.action === 'BUY_TO_COVER',
      reason: signal.reason,
      confidence: signal.confidence
    };
  }
}

module.exports = RSIDivergenceStrategy;
