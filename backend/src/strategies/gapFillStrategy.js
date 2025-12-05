/**
 * Gap Fill Strategy
 *
 * Theory: Most price gaps tend to fill (70%+ of gaps fill within the first hour).
 * This strategy fades gap moves, betting on mean reversion to previous close.
 *
 * Entry Logic:
 * - Identify gaps > 1% from previous close
 * - FADE GAP UP: Short if gap > 2% with weak pre-market/volume
 * - FADE GAP DOWN: Long if gap > 2% with selling exhaustion
 * - Target: Previous day's close (gap fill)
 *
 * Best for: Morning trading, mean reversion
 */

const TechnicalIndicators = require('./technicalIndicators');

class GapFillStrategy {
  constructor(config = {}) {
    this.name = 'Gap Fill Strategy';
    this.description = 'Fades opening gaps betting on gap fill to previous close';

    // Configuration with defaults
    this.config = {
      minGapPercent: config.minGapPercent || 0.01, // Minimum 1% gap
      maxGapPercent: config.maxGapPercent || 0.05, // Maximum 5% gap (too extreme to fade)
      idealGapPercent: config.idealGapPercent || 0.025, // Ideal gap size for highest confidence
      volumeThreshold: config.volumeThreshold || 0.8, // Fade if volume < 80% avg (weak gap)
      gapFillTarget: config.gapFillTarget || 1.0, // 100% gap fill target
      partialFillTarget: config.partialFillTarget || 0.5, // 50% gap fill minimum
      stopLoss: config.stopLoss || 0.02, // 2% beyond gap (gap extension stop)
      positionSize: config.positionSize || 0.08, // 8% of portfolio
      maxHoldingMinutes: config.maxHoldingMinutes || 120, // Exit after 2 hours if not filled
      tradingWindow: config.tradingWindow || { start: 9.5, end: 11 } // Only trade 9:30-11 AM
    };

    // Track daily gap state
    this.dailyState = {
      date: null,
      previousClose: null,
      currentOpen: null,
      gapPercent: null,
      gapType: null,
      tradeTaken: false,
      entryTime: null
    };
  }

  /**
   * Analyze market data and generate trading signals
   */
  analyze(data) {
    const { previousClose, currentOpen, currentPrice, currentVolume, avgVolume, position, currentTime } = data;

    // Validate data
    if (!previousClose || !currentOpen) {
      return { action: 'HOLD', reason: 'Missing previous close or current open', confidence: 0 };
    }

    // Check if new trading day
    const today = new Date().toDateString();
    if (this.dailyState.date !== today) {
      this.resetDailyState(today, previousClose, currentOpen);
    }

    // Calculate gap
    const gap = TechnicalIndicators.Gap(previousClose, currentOpen);
    const gapPercent = Math.abs(gap.gapPercent) / 100;

    // Store gap info
    this.dailyState.gapPercent = gapPercent;
    this.dailyState.gapType = gap.gapType;

    // Check trading window
    const hour = currentTime
      ? new Date(currentTime).getHours() + new Date(currentTime).getMinutes() / 60
      : new Date().getHours() + new Date().getMinutes() / 60;

    if (hour < this.config.tradingWindow.start || hour > this.config.tradingWindow.end) {
      if (!position) {
        return {
          action: 'HOLD',
          reason: 'Outside gap trading window',
          confidence: 0,
          indicators: { gap, tradingWindow: this.config.tradingWindow }
        };
      }
    }

    // Validate gap size
    if (gapPercent < this.config.minGapPercent) {
      return {
        action: 'HOLD',
        reason: `Gap too small: ${(gapPercent * 100).toFixed(2)}% < ${(this.config.minGapPercent * 100)}%`,
        confidence: 0,
        indicators: { gapPercent, gapType: gap.gapType }
      };
    }

    if (gapPercent > this.config.maxGapPercent) {
      return {
        action: 'HOLD',
        reason: `Gap too large to fade: ${(gapPercent * 100).toFixed(2)}% > ${(this.config.maxGapPercent * 100)}%`,
        confidence: 0,
        indicators: { gapPercent, gapType: gap.gapType }
      };
    }

    // Calculate current gap fill progress
    const gapFillProgress = this.calculateGapFillProgress(previousClose, currentOpen, currentPrice);

    // Entry signals
    if (!position && !this.dailyState.tradeTaken) {
      const volumeRatio = currentVolume / avgVolume;
      const isWeakVolume = volumeRatio < this.config.volumeThreshold;

      // FADE GAP UP (Short)
      if (gap.gapType === 'gap_up') {
        // Check if gap hasn't already started filling too much
        if (gapFillProgress < 0.3) {
          const confidence = this.calculateConfidence(gapPercent, volumeRatio, 'gap_up', gapFillProgress);

          // Strong signal if volume is weak (no conviction behind gap)
          if (isWeakVolume || confidence >= 60) {
            this.dailyState.tradeTaken = true;
            this.dailyState.entryTime = currentTime;

            return {
              action: 'SELL_SHORT',
              reason: `Fading ${(gapPercent * 100).toFixed(2)}% gap up${isWeakVolume ? ' (weak volume)' : ''}`,
              confidence,
              targets: {
                entry: currentPrice,
                profitTarget: previousClose, // Full gap fill
                partialTarget: currentOpen - (gap.gapAmount * this.config.partialFillTarget),
                stopLoss: currentOpen * (1 + this.config.stopLoss) // Stop above gap high
              },
              indicators: {
                gapPercent,
                gapType: 'gap_up',
                previousClose,
                currentOpen,
                volumeRatio,
                gapFillProgress
              }
            };
          }
        }
      }

      // FADE GAP DOWN (Long)
      if (gap.gapType === 'gap_down') {
        if (gapFillProgress < 0.3) {
          const confidence = this.calculateConfidence(gapPercent, volumeRatio, 'gap_down', gapFillProgress);

          if (isWeakVolume || confidence >= 60) {
            this.dailyState.tradeTaken = true;
            this.dailyState.entryTime = currentTime;

            return {
              action: 'BUY',
              reason: `Fading ${(gapPercent * 100).toFixed(2)}% gap down${isWeakVolume ? ' (weak selling)' : ''}`,
              confidence,
              targets: {
                entry: currentPrice,
                profitTarget: previousClose, // Full gap fill
                partialTarget: currentOpen + (Math.abs(gap.gapAmount) * this.config.partialFillTarget),
                stopLoss: currentOpen * (1 - this.config.stopLoss) // Stop below gap low
              },
              indicators: {
                gapPercent,
                gapType: 'gap_down',
                previousClose,
                currentOpen,
                volumeRatio,
                gapFillProgress
              }
            };
          }
        }
      }
    }

    // Exit signals
    if (position) {
      const entryPrice = position.entryPrice;
      const positionSide = position.side;
      const entryTime = this.dailyState.entryTime;

      // Calculate holding time
      const holdingMinutes = entryTime
        ? (new Date(currentTime) - new Date(entryTime)) / 60000
        : 0;

      if (positionSide === 'short') { // Faded gap up
        const pnlPercent = (entryPrice - currentPrice) / entryPrice;

        // Full gap fill achieved
        if (currentPrice <= previousClose) {
          return {
            action: 'BUY_TO_COVER',
            reason: `Gap filled! Profit: ${(pnlPercent * 100).toFixed(2)}%`,
            confidence: 95,
            indicators: { pnlPercent, gapFilled: true }
          };
        }

        // Partial fill target
        if (gapFillProgress >= this.config.partialFillTarget && pnlPercent > 0.01) {
          return {
            action: 'BUY_TO_COVER',
            reason: `Partial gap fill (${(gapFillProgress * 100).toFixed(0)}%), taking profit`,
            confidence: 80,
            indicators: { pnlPercent, gapFillProgress }
          };
        }

        // Stop loss - gap extending further
        if (currentPrice >= currentOpen * (1 + this.config.stopLoss)) {
          return {
            action: 'BUY_TO_COVER',
            reason: `Stop loss: Gap extending, ${(pnlPercent * 100).toFixed(2)}% loss`,
            confidence: 95,
            indicators: { pnlPercent, reason: 'gap_extension' }
          };
        }

        // Time stop
        if (holdingMinutes >= this.config.maxHoldingMinutes) {
          return {
            action: 'BUY_TO_COVER',
            reason: `Time stop: ${holdingMinutes.toFixed(0)} min, ${(pnlPercent * 100).toFixed(2)}%`,
            confidence: 85,
            indicators: { pnlPercent, holdingMinutes }
          };
        }
      }

      if (positionSide === 'long') { // Faded gap down
        const pnlPercent = (currentPrice - entryPrice) / entryPrice;

        // Full gap fill
        if (currentPrice >= previousClose) {
          return {
            action: 'SELL',
            reason: `Gap filled! Profit: ${(pnlPercent * 100).toFixed(2)}%`,
            confidence: 95,
            indicators: { pnlPercent, gapFilled: true }
          };
        }

        // Partial fill
        if (gapFillProgress >= this.config.partialFillTarget && pnlPercent > 0.01) {
          return {
            action: 'SELL',
            reason: `Partial gap fill (${(gapFillProgress * 100).toFixed(0)}%), taking profit`,
            confidence: 80,
            indicators: { pnlPercent, gapFillProgress }
          };
        }

        // Stop loss
        if (currentPrice <= currentOpen * (1 - this.config.stopLoss)) {
          return {
            action: 'SELL',
            reason: `Stop loss: Gap extending, ${(pnlPercent * 100).toFixed(2)}% loss`,
            confidence: 95,
            indicators: { pnlPercent }
          };
        }

        // Time stop
        if (holdingMinutes >= this.config.maxHoldingMinutes) {
          return {
            action: 'SELL',
            reason: `Time stop: ${holdingMinutes.toFixed(0)} min`,
            confidence: 85,
            indicators: { pnlPercent, holdingMinutes }
          };
        }
      }
    }

    // Waiting for signal
    return {
      action: 'HOLD',
      reason: gap.gapType !== 'none'
        ? `${gap.gapType.replace('_', ' ')} detected (${(gapPercent * 100).toFixed(2)}%), analyzing...`
        : 'No significant gap detected',
      confidence: 0,
      indicators: {
        gapPercent,
        gapType: gap.gapType,
        previousClose,
        currentOpen,
        gapFillProgress
      }
    };
  }

  /**
   * Calculate how much of the gap has filled
   */
  calculateGapFillProgress(previousClose, currentOpen, currentPrice) {
    const gapSize = Math.abs(currentOpen - previousClose);
    if (gapSize === 0) return 1;

    if (currentOpen > previousClose) {
      // Gap up - filling means price coming down
      const filled = currentOpen - currentPrice;
      return Math.max(0, Math.min(1, filled / gapSize));
    } else {
      // Gap down - filling means price going up
      const filled = currentPrice - currentOpen;
      return Math.max(0, Math.min(1, filled / gapSize));
    }
  }

  /**
   * Reset daily state
   */
  resetDailyState(date, previousClose, currentOpen) {
    this.dailyState = {
      date,
      previousClose,
      currentOpen,
      gapPercent: null,
      gapType: null,
      tradeTaken: false,
      entryTime: null
    };
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(gapPercent, volumeRatio, gapType, fillProgress) {
    let confidence = 45;

    // Ideal gap size (2-3% is sweet spot)
    if (gapPercent >= 0.02 && gapPercent <= 0.03) {
      confidence += 20;
    } else if (gapPercent >= 0.015 && gapPercent <= 0.04) {
      confidence += 15;
    } else {
      confidence += 5;
    }

    // Weak volume = gap lacks conviction = higher confidence in fade
    if (volumeRatio < 0.6) confidence += 20;
    else if (volumeRatio < 0.8) confidence += 15;
    else if (volumeRatio < 1.0) confidence += 10;
    else confidence -= 5; // Strong volume = gap might continue

    // Gap hasn't started filling yet = better entry
    if (fillProgress < 0.1) confidence += 10;
    else if (fillProgress < 0.2) confidence += 5;

    // Time of day (earlier = better for gap fills)
    const hour = new Date().getHours() + new Date().getMinutes() / 60;
    if (hour < 10) confidence += 10;
    else if (hour < 10.5) confidence += 5;

    return Math.min(95, Math.max(0, confidence));
  }

  /**
   * Simplified interface for trading bot
   */
  checkEntry(priceHistory, volumeHistory, currentPrice) {
    // Estimate previous close and current open from history
    const previousClose = priceHistory.length > 1 ? priceHistory[priceHistory.length - 2] : currentPrice;
    const currentOpen = priceHistory.length > 0 ? priceHistory[0] : currentPrice;
    const avgVolume = volumeHistory.reduce((a, b) => a + b, 0) / volumeHistory.length;
    const currentVolume = volumeHistory[volumeHistory.length - 1] || avgVolume;

    const signal = this.analyze({
      previousClose,
      currentOpen,
      currentPrice,
      currentVolume,
      avgVolume,
      position: null,
      currentTime: new Date()
    });

    return {
      shouldEnter: (signal.action === 'BUY' || signal.action === 'SELL_SHORT') && signal.confidence >= 60,
      reason: signal.reason,
      confidence: signal.confidence,
      targets: signal.targets
    };
  }

  /**
   * Check exit conditions
   */
  checkExit(priceHistory, volumeHistory, currentPrice, position) {
    const previousClose = priceHistory.length > 1 ? priceHistory[priceHistory.length - 2] : currentPrice;
    const currentOpen = priceHistory.length > 0 ? priceHistory[0] : currentPrice;
    const avgVolume = volumeHistory.reduce((a, b) => a + b, 0) / volumeHistory.length;
    const currentVolume = volumeHistory[volumeHistory.length - 1];

    const signal = this.analyze({
      previousClose,
      currentOpen,
      currentPrice,
      currentVolume,
      avgVolume,
      position,
      currentTime: new Date()
    });

    return {
      shouldExit: signal.action === 'SELL' || signal.action === 'BUY_TO_COVER',
      reason: signal.reason,
      confidence: signal.confidence
    };
  }
}

module.exports = GapFillStrategy;
