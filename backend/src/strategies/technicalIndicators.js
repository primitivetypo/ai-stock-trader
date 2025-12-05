/**
 * Technical Indicators Library
 * Comprehensive set of technical analysis indicators for trading strategies
 */

class TechnicalIndicators {
  /**
   * Simple Moving Average (SMA)
   * @param {number[]} prices - Array of prices
   * @param {number} period - Period for SMA calculation
   * @returns {number} - SMA value
   */
  static SMA(prices, period) {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    return slice.reduce((sum, price) => sum + price, 0) / period;
  }

  /**
   * Exponential Moving Average (EMA)
   * @param {number[]} prices - Array of prices
   * @param {number} period - Period for EMA calculation
   * @returns {number} - EMA value
   */
  static EMA(prices, period) {
    if (prices.length < period) return null;

    const multiplier = 2 / (period + 1);
    let ema = this.SMA(prices.slice(0, period), period);

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  /**
   * Calculate all EMAs for a price series
   * @param {number[]} prices - Array of prices
   * @param {number} period - Period for EMA calculation
   * @returns {number[]} - Array of EMA values
   */
  static EMAArray(prices, period) {
    if (prices.length < period) return [];

    const multiplier = 2 / (period + 1);
    const emas = [];
    let ema = this.SMA(prices.slice(0, period), period);
    emas.push(ema);

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
      emas.push(ema);
    }

    return emas;
  }

  /**
   * Relative Strength Index (RSI)
   * @param {number[]} prices - Array of prices
   * @param {number} period - Period for RSI calculation (default: 14)
   * @returns {number} - RSI value (0-100)
   */
  static RSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;

    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    const recentChanges = changes.slice(-period);
    let gains = 0;
    let losses = 0;

    for (const change of recentChanges) {
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calculate RSI array for a price series
   * @param {number[]} prices - Array of prices
   * @param {number} period - Period for RSI calculation
   * @returns {number[]} - Array of RSI values
   */
  static RSIArray(prices, period = 14) {
    if (prices.length < period + 1) return [];

    const rsiValues = [];
    for (let i = period + 1; i <= prices.length; i++) {
      const slice = prices.slice(0, i);
      rsiValues.push(this.RSI(slice, period));
    }

    return rsiValues;
  }

  /**
   * Moving Average Convergence Divergence (MACD)
   * @param {number[]} prices - Array of prices
   * @param {number} fastPeriod - Fast EMA period (default: 12)
   * @param {number} slowPeriod - Slow EMA period (default: 26)
   * @param {number} signalPeriod - Signal line period (default: 9)
   * @returns {Object} - { macd, signal, histogram }
   */
  static MACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (prices.length < slowPeriod + signalPeriod) {
      return { macd: 0, signal: 0, histogram: 0 };
    }

    const fastEMA = this.EMA(prices, fastPeriod);
    const slowEMA = this.EMA(prices, slowPeriod);
    const macd = fastEMA - slowEMA;

    // Calculate MACD line history for signal line
    const macdHistory = [];
    for (let i = slowPeriod; i <= prices.length; i++) {
      const slice = prices.slice(0, i);
      const fast = this.EMA(slice, fastPeriod);
      const slow = this.EMA(slice, slowPeriod);
      if (fast !== null && slow !== null) {
        macdHistory.push(fast - slow);
      }
    }

    const signal = macdHistory.length >= signalPeriod
      ? this.EMA(macdHistory, signalPeriod)
      : macd;
    const histogram = macd - signal;

    return { macd, signal, histogram };
  }

  /**
   * Bollinger Bands
   * @param {number[]} prices - Array of prices
   * @param {number} period - Period for calculation (default: 20)
   * @param {number} stdDevMultiplier - Standard deviation multiplier (default: 2)
   * @returns {Object} - { upper, middle, lower, bandwidth, percentB }
   */
  static BollingerBands(prices, period = 20, stdDevMultiplier = 2) {
    if (prices.length < period) {
      return { upper: null, middle: null, lower: null, bandwidth: null, percentB: null };
    }

    const slice = prices.slice(-period);
    const middle = slice.reduce((sum, p) => sum + p, 0) / period;

    const squaredDiffs = slice.map(p => Math.pow(p - middle, 2));
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / period;
    const stdDev = Math.sqrt(variance);

    const upper = middle + (stdDevMultiplier * stdDev);
    const lower = middle - (stdDevMultiplier * stdDev);
    const bandwidth = (upper - lower) / middle;
    const currentPrice = prices[prices.length - 1];
    const percentB = (currentPrice - lower) / (upper - lower);

    return { upper, middle, lower, bandwidth, percentB };
  }

  /**
   * Keltner Channels
   * @param {number[]} highs - Array of high prices
   * @param {number[]} lows - Array of low prices
   * @param {number[]} closes - Array of close prices
   * @param {number} period - Period for calculation (default: 20)
   * @param {number} atrMultiplier - ATR multiplier (default: 1.5)
   * @returns {Object} - { upper, middle, lower }
   */
  static KeltnerChannels(highs, lows, closes, period = 20, atrMultiplier = 1.5) {
    if (closes.length < period) {
      return { upper: null, middle: null, lower: null };
    }

    const middle = this.EMA(closes, period);
    const atr = this.ATR(highs, lows, closes, period);

    const upper = middle + (atrMultiplier * atr);
    const lower = middle - (atrMultiplier * atr);

    return { upper, middle, lower };
  }

  /**
   * Average True Range (ATR)
   * @param {number[]} highs - Array of high prices
   * @param {number[]} lows - Array of low prices
   * @param {number[]} closes - Array of close prices
   * @param {number} period - Period for ATR calculation (default: 14)
   * @returns {number} - ATR value
   */
  static ATR(highs, lows, closes, period = 14) {
    if (highs.length < period + 1) return null;

    const trueRanges = [];
    for (let i = 1; i < highs.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }

    // Use Wilder's smoothing (exponential moving average)
    const recentTRs = trueRanges.slice(-period);
    return recentTRs.reduce((sum, tr) => sum + tr, 0) / period;
  }

  /**
   * Volume Weighted Average Price (VWAP)
   * @param {Object[]} bars - Array of bar objects with high, low, close, volume
   * @returns {number} - VWAP value
   */
  static VWAP(bars) {
    if (bars.length === 0) return null;

    let cumulativeTPV = 0;
    let cumulativeVolume = 0;

    for (const bar of bars) {
      const typicalPrice = (bar.high + bar.low + bar.close) / 3;
      cumulativeTPV += typicalPrice * bar.volume;
      cumulativeVolume += bar.volume;
    }

    return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : null;
  }

  /**
   * Standard Deviation
   * @param {number[]} data - Array of numbers
   * @param {number} period - Period for calculation
   * @returns {number} - Standard deviation
   */
  static StdDev(data, period) {
    if (data.length < period) return null;

    const slice = data.slice(-period);
    const mean = slice.reduce((sum, val) => sum + val, 0) / period;
    const squaredDiffs = slice.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / period;

    return Math.sqrt(variance);
  }

  /**
   * Z-Score
   * @param {number[]} data - Array of numbers
   * @returns {number} - Z-score of the last value
   */
  static ZScore(data) {
    if (data.length < 2) return 0;

    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const stdDev = this.StdDev(data, data.length);

    if (stdDev === 0 || stdDev === null) return 0;

    const current = data[data.length - 1];
    return (current - mean) / stdDev;
  }

  /**
   * Stochastic Oscillator
   * @param {number[]} highs - Array of high prices
   * @param {number[]} lows - Array of low prices
   * @param {number[]} closes - Array of close prices
   * @param {number} kPeriod - %K period (default: 14)
   * @param {number} dPeriod - %D period (default: 3)
   * @returns {Object} - { k, d }
   */
  static Stochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
    if (closes.length < kPeriod) {
      return { k: 50, d: 50 };
    }

    // Calculate %K values
    const kValues = [];
    for (let i = kPeriod - 1; i < closes.length; i++) {
      const highSlice = highs.slice(i - kPeriod + 1, i + 1);
      const lowSlice = lows.slice(i - kPeriod + 1, i + 1);
      const highestHigh = Math.max(...highSlice);
      const lowestLow = Math.min(...lowSlice);

      const k = highestHigh !== lowestLow
        ? ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100
        : 50;
      kValues.push(k);
    }

    const k = kValues[kValues.length - 1];
    const d = kValues.length >= dPeriod
      ? this.SMA(kValues, dPeriod)
      : k;

    return { k, d };
  }

  /**
   * Williams %R
   * @param {number[]} highs - Array of high prices
   * @param {number[]} lows - Array of low prices
   * @param {number[]} closes - Array of close prices
   * @param {number} period - Lookback period (default: 14)
   * @returns {number} - Williams %R value (-100 to 0)
   */
  static WilliamsR(highs, lows, closes, period = 14) {
    if (closes.length < period) return -50;

    const highSlice = highs.slice(-period);
    const lowSlice = lows.slice(-period);
    const highestHigh = Math.max(...highSlice);
    const lowestLow = Math.min(...lowSlice);
    const currentClose = closes[closes.length - 1];

    if (highestHigh === lowestLow) return -50;

    return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
  }

  /**
   * On-Balance Volume (OBV)
   * @param {number[]} closes - Array of close prices
   * @param {number[]} volumes - Array of volumes
   * @returns {number} - OBV value
   */
  static OBV(closes, volumes) {
    if (closes.length < 2) return 0;

    let obv = 0;
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) {
        obv += volumes[i];
      } else if (closes[i] < closes[i - 1]) {
        obv -= volumes[i];
      }
    }

    return obv;
  }

  /**
   * Money Flow Index (MFI)
   * @param {number[]} highs - Array of high prices
   * @param {number[]} lows - Array of low prices
   * @param {number[]} closes - Array of close prices
   * @param {number[]} volumes - Array of volumes
   * @param {number} period - Period for MFI calculation (default: 14)
   * @returns {number} - MFI value (0-100)
   */
  static MFI(highs, lows, closes, volumes, period = 14) {
    if (closes.length < period + 1) return 50;

    const typicalPrices = [];
    const rawMoneyFlows = [];

    for (let i = 0; i < closes.length; i++) {
      const tp = (highs[i] + lows[i] + closes[i]) / 3;
      typicalPrices.push(tp);
      rawMoneyFlows.push(tp * volumes[i]);
    }

    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let i = closes.length - period; i < closes.length; i++) {
      if (typicalPrices[i] > typicalPrices[i - 1]) {
        positiveFlow += rawMoneyFlows[i];
      } else {
        negativeFlow += rawMoneyFlows[i];
      }
    }

    if (negativeFlow === 0) return 100;
    const moneyRatio = positiveFlow / negativeFlow;
    return 100 - (100 / (1 + moneyRatio));
  }

  /**
   * Commodity Channel Index (CCI)
   * @param {number[]} highs - Array of high prices
   * @param {number[]} lows - Array of low prices
   * @param {number[]} closes - Array of close prices
   * @param {number} period - Period for CCI calculation (default: 20)
   * @returns {number} - CCI value
   */
  static CCI(highs, lows, closes, period = 20) {
    if (closes.length < period) return 0;

    const typicalPrices = [];
    for (let i = 0; i < closes.length; i++) {
      typicalPrices.push((highs[i] + lows[i] + closes[i]) / 3);
    }

    const recentTP = typicalPrices.slice(-period);
    const sma = this.SMA(recentTP, period);

    // Mean deviation
    const meanDeviation = recentTP.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;

    if (meanDeviation === 0) return 0;

    const currentTP = typicalPrices[typicalPrices.length - 1];
    return (currentTP - sma) / (0.015 * meanDeviation);
  }

  /**
   * Pivot Points (Classic)
   * @param {number} high - Previous period high
   * @param {number} low - Previous period low
   * @param {number} close - Previous period close
   * @returns {Object} - { pivot, r1, r2, r3, s1, s2, s3 }
   */
  static PivotPoints(high, low, close) {
    const pivot = (high + low + close) / 3;

    return {
      pivot,
      r1: (2 * pivot) - low,
      r2: pivot + (high - low),
      r3: high + 2 * (pivot - low),
      s1: (2 * pivot) - high,
      s2: pivot - (high - low),
      s3: low - 2 * (high - pivot)
    };
  }

  /**
   * Fibonacci Retracement Levels
   * @param {number} high - Swing high
   * @param {number} low - Swing low
   * @param {string} trend - 'up' or 'down'
   * @returns {Object} - Fibonacci levels
   */
  static FibonacciLevels(high, low, trend = 'up') {
    const diff = high - low;
    const levels = {
      0: trend === 'up' ? low : high,
      0.236: trend === 'up' ? low + (diff * 0.236) : high - (diff * 0.236),
      0.382: trend === 'up' ? low + (diff * 0.382) : high - (diff * 0.382),
      0.5: trend === 'up' ? low + (diff * 0.5) : high - (diff * 0.5),
      0.618: trend === 'up' ? low + (diff * 0.618) : high - (diff * 0.618),
      0.786: trend === 'up' ? low + (diff * 0.786) : high - (diff * 0.786),
      1: trend === 'up' ? high : low
    };

    return levels;
  }

  /**
   * Calculate Support Level
   * @param {number[]} prices - Array of prices
   * @returns {number} - Support level
   */
  static Support(prices) {
    if (prices.length < 10) return Math.min(...prices);

    // Find local minima
    const minima = [];
    for (let i = 2; i < prices.length - 2; i++) {
      if (prices[i] < prices[i - 1] && prices[i] < prices[i - 2] &&
          prices[i] < prices[i + 1] && prices[i] < prices[i + 2]) {
        minima.push(prices[i]);
      }
    }

    return minima.length > 0
      ? minima.reduce((a, b) => a + b, 0) / minima.length
      : Math.min(...prices);
  }

  /**
   * Calculate Resistance Level
   * @param {number[]} prices - Array of prices
   * @returns {number} - Resistance level
   */
  static Resistance(prices) {
    if (prices.length < 10) return Math.max(...prices);

    // Find local maxima
    const maxima = [];
    for (let i = 2; i < prices.length - 2; i++) {
      if (prices[i] > prices[i - 1] && prices[i] > prices[i - 2] &&
          prices[i] > prices[i + 1] && prices[i] > prices[i + 2]) {
        maxima.push(prices[i]);
      }
    }

    return maxima.length > 0
      ? maxima.reduce((a, b) => a + b, 0) / maxima.length
      : Math.max(...prices);
  }

  /**
   * Detect RSI Divergence
   * @param {number[]} prices - Array of prices
   * @param {number[]} rsiValues - Array of RSI values
   * @param {number} lookback - Number of periods to look back (default: 14)
   * @returns {Object} - { bullish: boolean, bearish: boolean }
   */
  static RSIDivergence(prices, rsiValues, lookback = 14) {
    if (prices.length < lookback || rsiValues.length < lookback) {
      return { bullish: false, bearish: false };
    }

    const recentPrices = prices.slice(-lookback);
    const recentRSI = rsiValues.slice(-lookback);

    // Find price lows/highs
    const priceMin1Idx = recentPrices.indexOf(Math.min(...recentPrices.slice(0, Math.floor(lookback / 2))));
    const priceMin2Idx = recentPrices.slice(Math.floor(lookback / 2)).indexOf(
      Math.min(...recentPrices.slice(Math.floor(lookback / 2)))
    ) + Math.floor(lookback / 2);

    const priceMax1Idx = recentPrices.indexOf(Math.max(...recentPrices.slice(0, Math.floor(lookback / 2))));
    const priceMax2Idx = recentPrices.slice(Math.floor(lookback / 2)).indexOf(
      Math.max(...recentPrices.slice(Math.floor(lookback / 2)))
    ) + Math.floor(lookback / 2);

    // Bullish divergence: Price makes lower low, RSI makes higher low
    const bullish = recentPrices[priceMin2Idx] < recentPrices[priceMin1Idx] &&
                    recentRSI[priceMin2Idx] > recentRSI[priceMin1Idx];

    // Bearish divergence: Price makes higher high, RSI makes lower high
    const bearish = recentPrices[priceMax2Idx] > recentPrices[priceMax1Idx] &&
                    recentRSI[priceMax2Idx] < recentRSI[priceMax1Idx];

    return { bullish, bearish };
  }

  /**
   * Check if Bollinger Bands are squeezed inside Keltner Channels
   * @param {Object} bb - Bollinger Bands { upper, lower }
   * @param {Object} kc - Keltner Channels { upper, lower }
   * @returns {boolean} - True if squeeze is on
   */
  static BollingerSqueeze(bb, kc) {
    if (!bb.upper || !kc.upper) return false;
    return bb.lower > kc.lower && bb.upper < kc.upper;
  }

  /**
   * Calculate Opening Range
   * @param {Object[]} bars - Intraday bars
   * @param {number} minutes - Opening range duration in minutes (default: 30)
   * @returns {Object} - { high, low, range }
   */
  static OpeningRange(bars, minutes = 30) {
    if (bars.length === 0) return { high: null, low: null, range: null };

    // Assume bars are sorted by time and represent intraday data
    const openingBars = bars.slice(0, Math.ceil(minutes / 5)); // Assuming 5-min bars

    if (openingBars.length === 0) return { high: null, low: null, range: null };

    const high = Math.max(...openingBars.map(b => b.high));
    const low = Math.min(...openingBars.map(b => b.low));
    const range = high - low;

    return { high, low, range };
  }

  /**
   * Calculate Gap
   * @param {number} previousClose - Previous day's close
   * @param {number} currentOpen - Current day's open
   * @returns {Object} - { gapAmount, gapPercent, gapType }
   */
  static Gap(previousClose, currentOpen) {
    const gapAmount = currentOpen - previousClose;
    const gapPercent = (gapAmount / previousClose) * 100;

    let gapType = 'none';
    if (gapPercent > 1) gapType = 'gap_up';
    else if (gapPercent < -1) gapType = 'gap_down';

    return { gapAmount, gapPercent, gapType };
  }

  /**
   * Average Directional Index (ADX)
   * @param {number[]} highs - Array of high prices
   * @param {number[]} lows - Array of low prices
   * @param {number[]} closes - Array of close prices
   * @param {number} period - Period for ADX calculation (default: 14)
   * @returns {Object} - { adx, plusDI, minusDI }
   */
  static ADX(highs, lows, closes, period = 14) {
    if (highs.length < period * 2) {
      return { adx: 25, plusDI: 25, minusDI: 25 };
    }

    const plusDMs = [];
    const minusDMs = [];
    const trueRanges = [];

    for (let i = 1; i < highs.length; i++) {
      const upMove = highs[i] - highs[i - 1];
      const downMove = lows[i - 1] - lows[i];

      plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);

      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }

    // Smooth the values
    const smoothPlusDM = this.EMA(plusDMs, period);
    const smoothMinusDM = this.EMA(minusDMs, period);
    const smoothTR = this.EMA(trueRanges, period);

    const plusDI = (smoothPlusDM / smoothTR) * 100;
    const minusDI = (smoothMinusDM / smoothTR) * 100;

    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;

    // ADX is smoothed DX
    const adx = dx; // Simplified - normally would smooth over period

    return { adx, plusDI, minusDI };
  }

  /**
   * Determine overall trend direction
   * @param {number[]} prices - Array of prices
   * @param {number} shortPeriod - Short MA period (default: 20)
   * @param {number} longPeriod - Long MA period (default: 50)
   * @returns {string} - 'bullish', 'bearish', or 'neutral'
   */
  static TrendDirection(prices, shortPeriod = 20, longPeriod = 50) {
    if (prices.length < longPeriod) return 'neutral';

    const shortMA = this.SMA(prices, shortPeriod);
    const longMA = this.SMA(prices, longPeriod);
    const currentPrice = prices[prices.length - 1];

    if (shortMA > longMA && currentPrice > shortMA) return 'bullish';
    if (shortMA < longMA && currentPrice < shortMA) return 'bearish';
    return 'neutral';
  }
}

module.exports = TechnicalIndicators;
