/**
 * Trailing Stop Service
 * Manages dynamic stop-loss levels that move with price
 * Types:
 * - Percentage trailing
 * - ATR-based trailing
 * - Chandelier exit
 * - Moving average trailing
 * - Breakeven stop
 */

const TechnicalIndicators = require('../strategies/technicalIndicators');

class TrailingStopService {
  constructor() {
    // Track active stops by position ID
    this.activeStops = new Map();
  }

  /**
   * Create a new trailing stop
   */
  createStop(params) {
    const {
      positionId,
      symbol,
      side, // 'long' or 'short'
      entryPrice,
      stopType = 'percentage',
      config = {}
    } = params;

    const stop = {
      positionId,
      symbol,
      side,
      entryPrice,
      stopType,
      config: this.getDefaultConfig(stopType, config),
      currentStopPrice: this.calculateInitialStop(params),
      highestPrice: entryPrice, // For long positions
      lowestPrice: entryPrice, // For short positions
      isActive: true,
      createdAt: new Date(),
      lastUpdated: new Date(),
      history: []
    };

    this.activeStops.set(positionId, stop);
    return stop;
  }

  /**
   * Get default configuration for stop type
   */
  getDefaultConfig(stopType, customConfig) {
    const defaults = {
      percentage: {
        trailPercent: 0.03, // 3% trailing
        initialStopPercent: 0.02 // 2% initial stop
      },
      atr: {
        atrPeriod: 14,
        atrMultiplier: 2, // 2x ATR
        minStopPercent: 0.01 // Minimum 1% stop
      },
      chandelier: {
        atrPeriod: 22,
        atrMultiplier: 3, // 3x ATR (classic chandelier)
        lookbackPeriod: 22
      },
      movingAverage: {
        maPeriod: 10,
        maType: 'EMA', // 'SMA' or 'EMA'
        buffer: 0.005 // 0.5% buffer below MA
      },
      breakeven: {
        triggerPercent: 0.02, // Move to breakeven after 2% profit
        buffer: 0.001 // Add 0.1% buffer for fees
      },
      parabolic: {
        initialAF: 0.02,
        maxAF: 0.2,
        afIncrement: 0.02
      }
    };

    return { ...defaults[stopType], ...customConfig };
  }

  /**
   * Calculate initial stop price
   */
  calculateInitialStop(params) {
    const { side, entryPrice, stopType, config = {} } = params;
    const fullConfig = this.getDefaultConfig(stopType, config);

    if (side === 'long') {
      switch (stopType) {
        case 'percentage':
          return entryPrice * (1 - fullConfig.initialStopPercent);
        case 'atr':
        case 'chandelier':
        case 'movingAverage':
          return entryPrice * (1 - 0.02); // Default 2% until we have price data
        case 'breakeven':
          return entryPrice * (1 - 0.02);
        default:
          return entryPrice * (1 - 0.02);
      }
    } else {
      // Short position
      switch (stopType) {
        case 'percentage':
          return entryPrice * (1 + fullConfig.initialStopPercent);
        default:
          return entryPrice * (1 + 0.02);
      }
    }
  }

  /**
   * Update trailing stop based on current market data
   */
  updateStop(positionId, marketData) {
    const stop = this.activeStops.get(positionId);
    if (!stop || !stop.isActive) {
      return null;
    }

    const {
      currentPrice,
      high = currentPrice,
      low = currentPrice,
      priceHistory = [],
      highs = [],
      lows = [],
      closes = []
    } = marketData;

    const previousStop = stop.currentStopPrice;
    let newStop = previousStop;

    // Update highest/lowest prices
    if (stop.side === 'long') {
      stop.highestPrice = Math.max(stop.highestPrice, high, currentPrice);
    } else {
      stop.lowestPrice = Math.min(stop.lowestPrice, low, currentPrice);
    }

    // Calculate new stop based on type
    switch (stop.stopType) {
      case 'percentage':
        newStop = this.calculatePercentageTrail(stop, currentPrice);
        break;
      case 'atr':
        newStop = this.calculateATRTrail(stop, currentPrice, highs, lows, closes);
        break;
      case 'chandelier':
        newStop = this.calculateChandelierExit(stop, highs, lows, closes);
        break;
      case 'movingAverage':
        newStop = this.calculateMATrail(stop, priceHistory);
        break;
      case 'breakeven':
        newStop = this.calculateBreakevenStop(stop, currentPrice);
        break;
      case 'parabolic':
        newStop = this.calculateParabolicSAR(stop, currentPrice, high, low);
        break;
    }

    // Only update if stop moves in favorable direction
    if (stop.side === 'long' && newStop > stop.currentStopPrice) {
      stop.currentStopPrice = newStop;
      stop.lastUpdated = new Date();
      stop.history.push({ price: newStop, time: new Date(), trigger: currentPrice });
    } else if (stop.side === 'short' && newStop < stop.currentStopPrice) {
      stop.currentStopPrice = newStop;
      stop.lastUpdated = new Date();
      stop.history.push({ price: newStop, time: new Date(), trigger: currentPrice });
    }

    // Check if stop was hit
    const stopHit = this.checkStopHit(stop, currentPrice, low, high);

    return {
      ...stop,
      previousStop,
      stopMoved: stop.currentStopPrice !== previousStop,
      stopHit,
      profitLocked: stop.side === 'long'
        ? Math.max(0, (stop.currentStopPrice - stop.entryPrice) / stop.entryPrice)
        : Math.max(0, (stop.entryPrice - stop.currentStopPrice) / stop.entryPrice)
    };
  }

  /**
   * Percentage-based trailing stop
   */
  calculatePercentageTrail(stop, currentPrice) {
    const { trailPercent } = stop.config;

    if (stop.side === 'long') {
      return stop.highestPrice * (1 - trailPercent);
    } else {
      return stop.lowestPrice * (1 + trailPercent);
    }
  }

  /**
   * ATR-based trailing stop
   */
  calculateATRTrail(stop, currentPrice, highs, lows, closes) {
    const { atrPeriod, atrMultiplier, minStopPercent } = stop.config;

    if (highs.length < atrPeriod + 1 || lows.length < atrPeriod + 1) {
      return stop.currentStopPrice; // Not enough data
    }

    const atr = TechnicalIndicators.ATR(highs, lows, closes, atrPeriod);
    if (!atr) return stop.currentStopPrice;

    const atrStop = atr * atrMultiplier;
    const minStop = currentPrice * minStopPercent;
    const actualStop = Math.max(atrStop, minStop);

    if (stop.side === 'long') {
      return stop.highestPrice - actualStop;
    } else {
      return stop.lowestPrice + actualStop;
    }
  }

  /**
   * Chandelier Exit (ATR from highest high)
   */
  calculateChandelierExit(stop, highs, lows, closes) {
    const { atrPeriod, atrMultiplier, lookbackPeriod } = stop.config;

    if (highs.length < Math.max(atrPeriod, lookbackPeriod) + 1) {
      return stop.currentStopPrice;
    }

    const atr = TechnicalIndicators.ATR(highs, lows, closes, atrPeriod);
    if (!atr) return stop.currentStopPrice;

    const lookbackHighs = highs.slice(-lookbackPeriod);
    const lookbackLows = lows.slice(-lookbackPeriod);

    if (stop.side === 'long') {
      const highestHigh = Math.max(...lookbackHighs);
      return highestHigh - (atr * atrMultiplier);
    } else {
      const lowestLow = Math.min(...lookbackLows);
      return lowestLow + (atr * atrMultiplier);
    }
  }

  /**
   * Moving Average trailing stop
   */
  calculateMATrail(stop, priceHistory) {
    const { maPeriod, maType, buffer } = stop.config;

    if (priceHistory.length < maPeriod) {
      return stop.currentStopPrice;
    }

    let ma;
    if (maType === 'EMA') {
      ma = TechnicalIndicators.EMA(priceHistory, maPeriod);
    } else {
      ma = TechnicalIndicators.SMA(priceHistory, maPeriod);
    }

    if (!ma) return stop.currentStopPrice;

    if (stop.side === 'long') {
      return ma * (1 - buffer);
    } else {
      return ma * (1 + buffer);
    }
  }

  /**
   * Breakeven stop (move to entry after profit threshold)
   */
  calculateBreakevenStop(stop, currentPrice) {
    const { triggerPercent, buffer } = stop.config;

    if (stop.side === 'long') {
      const profitPercent = (currentPrice - stop.entryPrice) / stop.entryPrice;

      if (profitPercent >= triggerPercent) {
        // Move stop to breakeven + buffer
        return stop.entryPrice * (1 + buffer);
      }
    } else {
      const profitPercent = (stop.entryPrice - currentPrice) / stop.entryPrice;

      if (profitPercent >= triggerPercent) {
        return stop.entryPrice * (1 - buffer);
      }
    }

    return stop.currentStopPrice;
  }

  /**
   * Parabolic SAR trailing stop
   */
  calculateParabolicSAR(stop, currentPrice, high, low) {
    if (!stop.sarState) {
      // Initialize SAR state
      stop.sarState = {
        sar: stop.side === 'long' ? low : high,
        ep: stop.side === 'long' ? high : low, // Extreme point
        af: stop.config.initialAF
      };
    }

    const { initialAF, maxAF, afIncrement } = stop.config;
    let { sar, ep, af } = stop.sarState;

    if (stop.side === 'long') {
      // Update extreme point
      if (high > ep) {
        ep = high;
        af = Math.min(af + afIncrement, maxAF);
      }

      // Calculate new SAR
      sar = sar + af * (ep - sar);

      // SAR cannot be above recent lows
      sar = Math.min(sar, low);
    } else {
      // Short position
      if (low < ep) {
        ep = low;
        af = Math.min(af + afIncrement, maxAF);
      }

      sar = sar - af * (sar - ep);
      sar = Math.max(sar, high);
    }

    // Update state
    stop.sarState = { sar, ep, af };

    return sar;
  }

  /**
   * Check if stop was hit
   */
  checkStopHit(stop, currentPrice, low, high) {
    if (stop.side === 'long') {
      // For long positions, stop is hit if price goes below stop
      return low <= stop.currentStopPrice || currentPrice <= stop.currentStopPrice;
    } else {
      // For short positions, stop is hit if price goes above stop
      return high >= stop.currentStopPrice || currentPrice >= stop.currentStopPrice;
    }
  }

  /**
   * Get stop status for a position
   */
  getStop(positionId) {
    return this.activeStops.get(positionId);
  }

  /**
   * Remove stop when position is closed
   */
  removeStop(positionId) {
    const stop = this.activeStops.get(positionId);
    if (stop) {
      stop.isActive = false;
      stop.closedAt = new Date();
    }
    this.activeStops.delete(positionId);
    return stop;
  }

  /**
   * Get all active stops
   */
  getAllActiveStops() {
    return Array.from(this.activeStops.values()).filter(s => s.isActive);
  }

  /**
   * Update all active stops with market data
   */
  updateAllStops(marketDataBySymbol) {
    const results = [];

    for (const [positionId, stop] of this.activeStops) {
      if (!stop.isActive) continue;

      const marketData = marketDataBySymbol[stop.symbol];
      if (marketData) {
        const result = this.updateStop(positionId, marketData);
        if (result) {
          results.push(result);
        }
      }
    }

    return results;
  }

  /**
   * Get stops that have been hit
   */
  getTriggeredStops(marketDataBySymbol) {
    const triggered = [];

    for (const [positionId, stop] of this.activeStops) {
      if (!stop.isActive) continue;

      const marketData = marketDataBySymbol[stop.symbol];
      if (marketData) {
        const { currentPrice, low = currentPrice, high = currentPrice } = marketData;
        if (this.checkStopHit(stop, currentPrice, low, high)) {
          triggered.push({
            ...stop,
            triggerPrice: currentPrice,
            triggerTime: new Date()
          });
        }
      }
    }

    return triggered;
  }

  /**
   * Suggest best stop type based on conditions
   */
  suggestStopType(params) {
    const {
      volatility, // Historical volatility
      trend, // 'trending' or 'ranging'
      timeframe, // 'intraday', 'swing', 'position'
      profitTarget
    } = params;

    // High volatility: Use ATR or Chandelier
    if (volatility > 0.03) {
      return {
        recommended: 'atr',
        reason: 'High volatility - ATR adapts to market conditions',
        alternatives: ['chandelier']
      };
    }

    // Trending market: Use MA trailing
    if (trend === 'trending') {
      return {
        recommended: 'movingAverage',
        reason: 'Trending market - MA trailing captures the trend',
        alternatives: ['parabolic', 'percentage']
      };
    }

    // Intraday: Use tighter percentage stops
    if (timeframe === 'intraday') {
      return {
        recommended: 'percentage',
        reason: 'Intraday - simple percentage stop for quick trades',
        config: { trailPercent: 0.015, initialStopPercent: 0.01 },
        alternatives: ['breakeven']
      };
    }

    // Default: Use breakeven + percentage
    return {
      recommended: 'breakeven',
      reason: 'Default - protect capital then trail',
      config: { triggerPercent: 0.015 },
      alternatives: ['percentage']
    };
  }

  /**
   * Calculate optimal stop distance
   */
  calculateOptimalStop(priceHistory, highs, lows, closes, method = 'atr') {
    if (priceHistory.length < 20) {
      return { stopDistance: 0.02, method: 'default' };
    }

    switch (method) {
      case 'atr':
        const atr = TechnicalIndicators.ATR(highs, lows, closes, 14);
        if (atr) {
          const currentPrice = closes[closes.length - 1];
          return {
            stopDistance: (atr * 2) / currentPrice,
            atr,
            method: 'atr'
          };
        }
        break;

      case 'volatility':
        const returns = [];
        for (let i = 1; i < priceHistory.length; i++) {
          returns.push(Math.abs((priceHistory[i] - priceHistory[i - 1]) / priceHistory[i - 1]));
        }
        const avgMove = returns.reduce((a, b) => a + b, 0) / returns.length;
        return {
          stopDistance: avgMove * 2.5,
          avgMove,
          method: 'volatility'
        };

      case 'support':
        const support = TechnicalIndicators.Support(priceHistory);
        const currentPrice = priceHistory[priceHistory.length - 1];
        return {
          stopDistance: (currentPrice - support) / currentPrice,
          supportLevel: support,
          method: 'support'
        };
    }

    return { stopDistance: 0.02, method: 'default' };
  }
}

// Export singleton
let instance = null;

module.exports = {
  getTrailingStopService: () => {
    if (!instance) {
      instance = new TrailingStopService();
    }
    return instance;
  },
  TrailingStopService
};
