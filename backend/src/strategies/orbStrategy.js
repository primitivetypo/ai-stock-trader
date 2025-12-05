/**
 * Opening Range Breakout (ORB) Strategy
 *
 * Theory: The first 15-30 minutes of trading establishes the day's opening range.
 * A breakout from this range often indicates the direction for the rest of the day.
 *
 * Entry Logic:
 * - Define opening range from first 30 minutes of trading
 * - BUY when price breaks above range high with volume
 * - SELL SHORT when price breaks below range low with volume
 * - Only trade if range is reasonable (< 2% of price)
 *
 * Best for: Intraday trading, momentum following
 */

const TechnicalIndicators = require('./technicalIndicators');

class ORBStrategy {
  constructor(config = {}) {
    this.name = 'Opening Range Breakout';
    this.description = 'Trades breakouts from the first 30-minute range';

    // Configuration with defaults
    this.config = {
      openingRangeMinutes: config.openingRangeMinutes || 30,
      breakoutThreshold: config.breakoutThreshold || 0.001, // 0.1% above/below range
      maxRangePercent: config.maxRangePercent || 0.02, // Max 2% range (skip volatile days)
      minRangePercent: config.minRangePercent || 0.003, // Min 0.3% range (skip too tight)
      volumeConfirmation: config.volumeConfirmation || 1.2, // 1.2x avg volume
      profitTarget: config.profitTarget || 0.015, // 1.5x range as target (calculated dynamically)
      stopLoss: config.stopLoss || 0.5, // 50% of range as stop (calculated dynamically)
      positionSize: config.positionSize || 0.1, // 10% of portfolio
      tradingHours: config.tradingHours || { start: 9.5, end: 15.5 } // 9:30 AM - 3:30 PM
    };

    // Track opening range for the day
    this.dailyState = {
      date: null,
      rangeHigh: null,
      rangeLow: null,
      rangeSet: false,
      breakoutDirection: null, // 'up' or 'down'
      tradeTaken: false
    };
  }

  /**
   * Analyze market data and generate trading signals
   */
  analyze(data) {
    const { intradayBars, currentPrice, currentVolume, avgVolume, position, currentTime } = data;

    // Validate data
    if (!intradayBars || intradayBars.length < 6) { // Need at least 30 min of 5-min bars
      return { action: 'HOLD', reason: 'Insufficient intraday data', confidence: 0 };
    }

    // Check if new trading day
    const today = new Date().toDateString();
    if (this.dailyState.date !== today) {
      this.resetDailyState(today);
    }

    // Calculate opening range if not set
    if (!this.dailyState.rangeSet) {
      const rangeResult = this.calculateOpeningRange(intradayBars);
      if (rangeResult.success) {
        this.dailyState.rangeHigh = rangeResult.high;
        this.dailyState.rangeLow = rangeResult.low;
        this.dailyState.rangeSet = true;
        console.log(`📊 ORB Range set: High=${rangeResult.high.toFixed(2)}, Low=${rangeResult.low.toFixed(2)}, Range=${(rangeResult.rangePercent * 100).toFixed(2)}%`);
      } else {
        return {
          action: 'HOLD',
          reason: 'Opening range not yet established',
          confidence: 0
        };
      }
    }

    const rangeHigh = this.dailyState.rangeHigh;
    const rangeLow = this.dailyState.rangeLow;
    const rangeSize = rangeHigh - rangeLow;
    const rangePercent = rangeSize / rangeLow;

    // Validate range size
    if (rangePercent > this.config.maxRangePercent) {
      return {
        action: 'HOLD',
        reason: `Opening range too wide (${(rangePercent * 100).toFixed(2)}% > ${(this.config.maxRangePercent * 100)}%)`,
        confidence: 0,
        indicators: { rangeHigh, rangeLow, rangePercent }
      };
    }

    if (rangePercent < this.config.minRangePercent) {
      return {
        action: 'HOLD',
        reason: `Opening range too tight (${(rangePercent * 100).toFixed(2)}% < ${(this.config.minRangePercent * 100)}%)`,
        confidence: 0,
        indicators: { rangeHigh, rangeLow, rangePercent }
      };
    }

    // Check trading hours
    const hour = currentTime ? new Date(currentTime).getHours() + new Date(currentTime).getMinutes() / 60 : 12;
    if (hour < this.config.tradingHours.start || hour > this.config.tradingHours.end) {
      return {
        action: 'HOLD',
        reason: 'Outside trading hours for ORB strategy',
        confidence: 0
      };
    }

    // Calculate dynamic targets based on range
    const profitMultiplier = 1.5;
    const stopMultiplier = 0.5;

    // Entry signals (only one trade per day)
    if (!position && !this.dailyState.tradeTaken) {
      const volumeRatio = currentVolume / avgVolume;

      // Bullish breakout above range
      if (currentPrice > rangeHigh * (1 + this.config.breakoutThreshold)) {
        if (volumeRatio >= this.config.volumeConfirmation) {
          this.dailyState.breakoutDirection = 'up';
          this.dailyState.tradeTaken = true;

          const confidence = this.calculateConfidence(rangePercent, volumeRatio, 'up');
          const profitTarget = currentPrice + (rangeSize * profitMultiplier);
          const stopLoss = rangeHigh - (rangeSize * stopMultiplier);

          return {
            action: 'BUY',
            reason: `Bullish ORB breakout above ${rangeHigh.toFixed(2)} with ${volumeRatio.toFixed(1)}x volume`,
            confidence,
            targets: {
              entry: currentPrice,
              profitTarget,
              stopLoss,
              rangeMiddle: (rangeHigh + rangeLow) / 2
            },
            indicators: {
              rangeHigh,
              rangeLow,
              rangeSize,
              volumeRatio,
              breakoutDirection: 'up'
            }
          };
        } else {
          return {
            action: 'HOLD',
            reason: `Price above range but volume weak (${volumeRatio.toFixed(1)}x)`,
            confidence: 30,
            indicators: { rangeHigh, volumeRatio }
          };
        }
      }

      // Bearish breakout below range
      if (currentPrice < rangeLow * (1 - this.config.breakoutThreshold)) {
        if (volumeRatio >= this.config.volumeConfirmation) {
          this.dailyState.breakoutDirection = 'down';
          this.dailyState.tradeTaken = true;

          const confidence = this.calculateConfidence(rangePercent, volumeRatio, 'down');
          const profitTarget = currentPrice - (rangeSize * profitMultiplier);
          const stopLoss = rangeLow + (rangeSize * stopMultiplier);

          return {
            action: 'SELL_SHORT',
            reason: `Bearish ORB breakdown below ${rangeLow.toFixed(2)} with ${volumeRatio.toFixed(1)}x volume`,
            confidence,
            targets: {
              entry: currentPrice,
              profitTarget,
              stopLoss
            },
            indicators: {
              rangeHigh,
              rangeLow,
              rangeSize,
              volumeRatio,
              breakoutDirection: 'down'
            }
          };
        }
      }
    }

    // Exit signals
    if (position) {
      const entryPrice = position.entryPrice;
      const positionSide = position.side;
      const profitTarget = positionSide === 'long'
        ? entryPrice + (rangeSize * profitMultiplier)
        : entryPrice - (rangeSize * profitMultiplier);
      const stopLoss = positionSide === 'long'
        ? rangeHigh - (rangeSize * stopMultiplier)
        : rangeLow + (rangeSize * stopMultiplier);

      if (positionSide === 'long') {
        const pnlPercent = (currentPrice - entryPrice) / entryPrice;

        // Take profit
        if (currentPrice >= profitTarget) {
          return {
            action: 'SELL',
            reason: `ORB profit target reached: ${(pnlPercent * 100).toFixed(2)}%`,
            confidence: 90,
            indicators: { pnlPercent, profitTarget }
          };
        }

        // Stop loss - back inside range
        if (currentPrice <= stopLoss || currentPrice <= (rangeHigh + rangeLow) / 2) {
          return {
            action: 'SELL',
            reason: `ORB stop loss: Price back to range middle`,
            confidence: 95,
            indicators: { pnlPercent, currentPrice, rangeMiddle: (rangeHigh + rangeLow) / 2 }
          };
        }

        // End of day exit
        if (hour >= 15.75) { // 3:45 PM
          return {
            action: 'SELL',
            reason: `End of day exit: ${(pnlPercent * 100).toFixed(2)}%`,
            confidence: 85,
            indicators: { pnlPercent, reason: 'EOD' }
          };
        }
      }

      if (positionSide === 'short') {
        const pnlPercent = (entryPrice - currentPrice) / entryPrice;

        // Take profit
        if (currentPrice <= profitTarget) {
          return {
            action: 'BUY_TO_COVER',
            reason: `ORB short profit target: ${(pnlPercent * 100).toFixed(2)}%`,
            confidence: 90,
            indicators: { pnlPercent }
          };
        }

        // Stop loss
        if (currentPrice >= stopLoss || currentPrice >= (rangeHigh + rangeLow) / 2) {
          return {
            action: 'BUY_TO_COVER',
            reason: `ORB short stop loss: Price back to range`,
            confidence: 95,
            indicators: { pnlPercent }
          };
        }

        // End of day
        if (hour >= 15.75) {
          return {
            action: 'BUY_TO_COVER',
            reason: `End of day short cover: ${(pnlPercent * 100).toFixed(2)}%`,
            confidence: 85,
            indicators: { pnlPercent }
          };
        }
      }
    }

    // Price inside range - waiting
    return {
      action: 'HOLD',
      reason: `Price inside opening range [${rangeLow.toFixed(2)} - ${rangeHigh.toFixed(2)}], waiting for breakout`,
      confidence: 0,
      indicators: {
        rangeHigh,
        rangeLow,
        rangeSize,
        currentPrice,
        pricePosition: ((currentPrice - rangeLow) / rangeSize * 100).toFixed(0) + '% of range'
      }
    };
  }

  /**
   * Calculate opening range from intraday bars
   */
  calculateOpeningRange(bars) {
    // Assuming 5-minute bars, we need first 6 bars for 30 minutes
    const openingBars = bars.slice(0, 6);

    if (openingBars.length < 6) {
      return { success: false, reason: 'Not enough bars for opening range' };
    }

    const high = Math.max(...openingBars.map(b => b.high || b.close * 1.002));
    const low = Math.min(...openingBars.map(b => b.low || b.close * 0.998));
    const rangePercent = (high - low) / low;

    return {
      success: true,
      high,
      low,
      rangePercent
    };
  }

  /**
   * Reset daily state for new trading day
   */
  resetDailyState(date) {
    this.dailyState = {
      date,
      rangeHigh: null,
      rangeLow: null,
      rangeSet: false,
      breakoutDirection: null,
      tradeTaken: false
    };
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(rangePercent, volumeRatio, direction) {
    let confidence = 50;

    // Healthy range size (not too tight, not too wide)
    if (rangePercent > 0.005 && rangePercent < 0.015) {
      confidence += 15;
    } else if (rangePercent >= 0.003 && rangePercent <= 0.02) {
      confidence += 10;
    }

    // Strong volume confirmation
    if (volumeRatio > 1.5) confidence += 20;
    else if (volumeRatio > 1.2) confidence += 15;
    else confidence += 5;

    // Early breakout (before 11 AM) is more reliable
    const hour = new Date().getHours() + new Date().getMinutes() / 60;
    if (hour < 11) confidence += 10;
    else if (hour < 13) confidence += 5;

    return Math.min(95, Math.max(0, confidence));
  }

  /**
   * Simplified interface for trading bot
   */
  checkEntry(priceHistory, volumeHistory, currentPrice) {
    // Create intraday bars estimate
    const intradayBars = priceHistory.slice(-20).map((p, i) => ({
      high: p * 1.002,
      low: p * 0.998,
      close: p,
      volume: volumeHistory[volumeHistory.length - 20 + i] || 1000000
    }));

    const avgVolume = volumeHistory.length > 0
      ? volumeHistory.reduce((a, b) => a + b, 0) / volumeHistory.length
      : 1000000;

    const signal = this.analyze({
      intradayBars,
      currentPrice,
      currentVolume: volumeHistory[volumeHistory.length - 1] || avgVolume,
      avgVolume,
      position: null,
      currentTime: new Date()
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
    const intradayBars = priceHistory.slice(-20).map((p, i) => ({
      high: p * 1.002,
      low: p * 0.998,
      close: p,
      volume: volumeHistory[volumeHistory.length - 20 + i] || 1000000
    }));

    const avgVolume = volumeHistory.reduce((a, b) => a + b, 0) / volumeHistory.length;

    const signal = this.analyze({
      intradayBars,
      currentPrice,
      currentVolume: volumeHistory[volumeHistory.length - 1],
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

module.exports = ORBStrategy;
