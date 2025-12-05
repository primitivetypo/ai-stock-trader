/**
 * Bollinger Squeeze Strategy
 *
 * Theory: When Bollinger Bands contract inside Keltner Channels, it indicates
 * low volatility (a "squeeze"). Explosive moves often follow squeezes.
 *
 * Entry Logic:
 * - Identify squeeze (BB inside KC)
 * - Wait for price to break out of bands after squeeze
 * - Use momentum oscillator to determine direction
 *
 * Best for: Catching breakouts after consolidation periods
 */

const TechnicalIndicators = require('./technicalIndicators');

class BollingerSqueezeStrategy {
  constructor(config = {}) {
    this.name = 'Bollinger Squeeze Strategy';
    this.description = 'Trades breakouts after volatility compression (BB squeeze)';

    // Configuration with defaults
    this.config = {
      bbPeriod: config.bbPeriod || 20,
      bbStdDev: config.bbStdDev || 2,
      kcPeriod: config.kcPeriod || 20,
      kcAtrMultiplier: config.kcAtrMultiplier || 1.5,
      momentumPeriod: config.momentumPeriod || 12,
      minSqueezeLength: config.minSqueezeLength || 3, // Minimum bars in squeeze
      profitTarget: config.profitTarget || 0.04, // 4% profit target
      stopLoss: config.stopLoss || 0.02, // 2% stop loss
      positionSize: config.positionSize || 0.08 // 8% of portfolio (volatile strategy)
    };

    // Track squeeze state
    this.squeezeState = {
      inSqueeze: false,
      squeezeBars: 0,
      squeezeReleased: false
    };
  }

  /**
   * Analyze market data and generate trading signals
   */
  analyze(data) {
    const { highs, lows, closes, volumes, currentPrice, position } = data;

    // Validate data
    if (!closes || closes.length < this.config.bbPeriod + 5) {
      return { action: 'HOLD', reason: 'Insufficient data', confidence: 0 };
    }

    // Calculate Bollinger Bands
    const bb = TechnicalIndicators.BollingerBands(closes, this.config.bbPeriod, this.config.bbStdDev);

    // Calculate Keltner Channels
    const kc = TechnicalIndicators.KeltnerChannels(
      highs, lows, closes,
      this.config.kcPeriod,
      this.config.kcAtrMultiplier
    );

    if (!bb.upper || !kc.upper) {
      return { action: 'HOLD', reason: 'Unable to calculate indicators', confidence: 0 };
    }

    // Check for squeeze
    const isSqueezing = TechnicalIndicators.BollingerSqueeze(bb, kc);

    // Calculate momentum for direction
    const momentum = this.calculateMomentum(closes, this.config.momentumPeriod);
    const momentumDirection = momentum > 0 ? 'bullish' : 'bearish';

    // Calculate momentum histogram for visual
    const prevMomentum = this.calculateMomentum(closes.slice(0, -1), this.config.momentumPeriod);
    const momentumIncreasing = Math.abs(momentum) > Math.abs(prevMomentum);

    // Update squeeze state
    if (isSqueezing) {
      this.squeezeState.inSqueeze = true;
      this.squeezeState.squeezeBars++;
      this.squeezeState.squeezeReleased = false;
    } else if (this.squeezeState.inSqueeze) {
      // Squeeze just released!
      this.squeezeState.squeezeReleased = true;
      this.squeezeState.inSqueeze = false;
    }

    // Entry signals - only after squeeze release
    if (!position) {
      const wasValidSqueeze = this.squeezeState.squeezeReleased &&
                              this.squeezeState.squeezeBars >= this.config.minSqueezeLength;

      if (wasValidSqueeze) {
        // Reset squeeze tracking
        const squeezeBars = this.squeezeState.squeezeBars;
        this.squeezeState.squeezeBars = 0;
        this.squeezeState.squeezeReleased = false;

        // Bullish breakout
        if (momentumDirection === 'bullish' && currentPrice > bb.middle) {
          const confidence = this.calculateConfidence(squeezeBars, momentum, bb, currentPrice);

          return {
            action: 'BUY',
            reason: `Squeeze released after ${squeezeBars} bars, bullish momentum`,
            confidence,
            targets: {
              entry: currentPrice,
              profitTarget: currentPrice * (1 + this.config.profitTarget),
              stopLoss: Math.max(bb.lower, currentPrice * (1 - this.config.stopLoss))
            },
            indicators: {
              bbUpper: bb.upper,
              bbLower: bb.lower,
              bbMiddle: bb.middle,
              bandwidth: bb.bandwidth,
              momentum,
              squeezeBars,
              isSqueezing
            }
          };
        }

        // Bearish breakout (short signal)
        if (momentumDirection === 'bearish' && currentPrice < bb.middle) {
          const confidence = this.calculateConfidence(squeezeBars, momentum, bb, currentPrice);

          return {
            action: 'SELL_SHORT',
            reason: `Squeeze released after ${squeezeBars} bars, bearish momentum`,
            confidence,
            targets: {
              entry: currentPrice,
              profitTarget: currentPrice * (1 - this.config.profitTarget),
              stopLoss: Math.min(bb.upper, currentPrice * (1 + this.config.stopLoss))
            },
            indicators: {
              bbUpper: bb.upper,
              bbLower: bb.lower,
              momentum,
              squeezeBars
            }
          };
        }
      }
    }

    // Exit signals for existing positions
    if (position) {
      const entryPrice = position.entryPrice;
      const positionSide = position.side;

      if (positionSide === 'long') {
        const pnlPercent = (currentPrice - entryPrice) / entryPrice;

        // Take profit at upper band or target
        if (currentPrice >= bb.upper || pnlPercent >= this.config.profitTarget) {
          return {
            action: 'SELL',
            reason: `Taking profit at ${(pnlPercent * 100).toFixed(2)}%, price at upper band`,
            confidence: 85,
            indicators: { pnlPercent, bbUpper: bb.upper }
          };
        }

        // Exit if momentum reverses
        if (momentumDirection === 'bearish' && !momentumIncreasing && pnlPercent > 0.01) {
          return {
            action: 'SELL',
            reason: 'Momentum reversing, taking profit',
            confidence: 70,
            indicators: { momentum, pnlPercent }
          };
        }

        // Stop loss
        if (currentPrice <= bb.lower || pnlPercent <= -this.config.stopLoss) {
          return {
            action: 'SELL',
            reason: `Stop loss at ${(pnlPercent * 100).toFixed(2)}%`,
            confidence: 95,
            indicators: { pnlPercent }
          };
        }
      }

      if (positionSide === 'short') {
        const pnlPercent = (entryPrice - currentPrice) / entryPrice;

        // Take profit
        if (currentPrice <= bb.lower || pnlPercent >= this.config.profitTarget) {
          return {
            action: 'BUY_TO_COVER',
            reason: `Taking profit on short at ${(pnlPercent * 100).toFixed(2)}%`,
            confidence: 85,
            indicators: { pnlPercent }
          };
        }

        // Stop loss
        if (currentPrice >= bb.upper || pnlPercent <= -this.config.stopLoss) {
          return {
            action: 'BUY_TO_COVER',
            reason: `Stop loss on short at ${(pnlPercent * 100).toFixed(2)}%`,
            confidence: 95,
            indicators: { pnlPercent }
          };
        }
      }
    }

    // Still in squeeze - waiting
    if (isSqueezing) {
      return {
        action: 'HOLD',
        reason: `Squeeze in progress (${this.squeezeState.squeezeBars} bars), waiting for release`,
        confidence: 0,
        indicators: {
          bbUpper: bb.upper,
          bbLower: bb.lower,
          bandwidth: bb.bandwidth,
          momentum,
          squeezeBars: this.squeezeState.squeezeBars,
          isSqueezing: true
        }
      };
    }

    return {
      action: 'HOLD',
      reason: 'No squeeze pattern detected',
      confidence: 0,
      indicators: { bandwidth: bb.bandwidth, momentum, isSqueezing: false }
    };
  }

  /**
   * Calculate momentum oscillator (Rate of Change)
   */
  calculateMomentum(prices, period) {
    if (prices.length < period + 1) return 0;
    const current = prices[prices.length - 1];
    const past = prices[prices.length - period - 1];
    return ((current - past) / past) * 100;
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(squeezeBars, momentum, bb, currentPrice) {
    let confidence = 50;

    // Longer squeeze = higher confidence (more compression = bigger move)
    if (squeezeBars >= 10) confidence += 20;
    else if (squeezeBars >= 6) confidence += 15;
    else if (squeezeBars >= 3) confidence += 10;

    // Stronger momentum = higher confidence
    const absMomentum = Math.abs(momentum);
    if (absMomentum > 3) confidence += 15;
    else if (absMomentum > 1.5) confidence += 10;
    else confidence += 5;

    // Price position relative to bands
    if (momentum > 0 && currentPrice > bb.middle) confidence += 10;
    if (momentum < 0 && currentPrice < bb.middle) confidence += 10;

    return Math.min(95, Math.max(0, confidence));
  }

  /**
   * Simplified interface for trading bot
   */
  checkEntry(priceHistory, volumeHistory, currentPrice) {
    // Create arrays needed for analysis
    const closes = priceHistory;
    const highs = priceHistory.map(p => p * 1.005); // Estimate
    const lows = priceHistory.map(p => p * 0.995); // Estimate

    const signal = this.analyze({
      highs,
      lows,
      closes,
      volumes: volumeHistory,
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
    const closes = priceHistory;
    const highs = priceHistory.map(p => p * 1.005);
    const lows = priceHistory.map(p => p * 0.995);

    const signal = this.analyze({
      highs,
      lows,
      closes,
      volumes: volumeHistory,
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

module.exports = BollingerSqueezeStrategy;
