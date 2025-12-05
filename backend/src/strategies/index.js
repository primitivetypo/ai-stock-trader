/**
 * Trading Strategies Index
 * Exports all available trading strategies
 */

const TechnicalIndicators = require('./technicalIndicators');
const VWAPStrategy = require('./vwapStrategy');
const BollingerSqueezeStrategy = require('./bollingerSqueezeStrategy');
const RSIDivergenceStrategy = require('./rsiDivergenceStrategy');
const ORBStrategy = require('./orbStrategy');
const GapFillStrategy = require('./gapFillStrategy');

// Strategy registry with metadata
const strategyRegistry = {
  'vwap': {
    class: VWAPStrategy,
    name: 'VWAP Strategy',
    description: 'Trades mean reversion to VWAP with volume confirmation',
    category: 'mean-reversion',
    timeframe: 'intraday',
    riskLevel: 'medium',
    defaultConfig: {
      vwapDeviation: 0.01,
      volumeThreshold: 1.2,
      profitTarget: 0.02,
      stopLoss: 0.015,
      positionSize: 0.1
    }
  },
  'bollinger-squeeze': {
    class: BollingerSqueezeStrategy,
    name: 'Bollinger Squeeze',
    description: 'Trades breakouts after volatility compression',
    category: 'breakout',
    timeframe: 'swing',
    riskLevel: 'high',
    defaultConfig: {
      bbPeriod: 20,
      bbStdDev: 2,
      kcPeriod: 20,
      kcAtrMultiplier: 1.5,
      profitTarget: 0.04,
      stopLoss: 0.02,
      positionSize: 0.08
    }
  },
  'rsi-divergence': {
    class: RSIDivergenceStrategy,
    name: 'RSI Divergence',
    description: 'Trades RSI divergence patterns for trend reversals',
    category: 'reversal',
    timeframe: 'swing',
    riskLevel: 'medium',
    defaultConfig: {
      rsiPeriod: 14,
      divergenceLookback: 20,
      profitTarget: 0.035,
      stopLoss: 0.02,
      positionSize: 0.1
    }
  },
  'orb': {
    class: ORBStrategy,
    name: 'Opening Range Breakout',
    description: 'Trades breakouts from the opening 30-minute range',
    category: 'breakout',
    timeframe: 'intraday',
    riskLevel: 'medium',
    defaultConfig: {
      openingRangeMinutes: 30,
      volumeConfirmation: 1.2,
      maxRangePercent: 0.02,
      profitTarget: 0.015,
      positionSize: 0.1
    }
  },
  'gap-fill': {
    class: GapFillStrategy,
    name: 'Gap Fill',
    description: 'Fades opening gaps betting on gap fill',
    category: 'mean-reversion',
    timeframe: 'intraday',
    riskLevel: 'medium',
    defaultConfig: {
      minGapPercent: 0.01,
      maxGapPercent: 0.05,
      gapFillTarget: 1.0,
      stopLoss: 0.02,
      positionSize: 0.08
    }
  }
};

/**
 * Create a strategy instance by key
 */
function createStrategy(strategyKey, customConfig = {}) {
  const strategyInfo = strategyRegistry[strategyKey];
  if (!strategyInfo) {
    throw new Error(`Unknown strategy: ${strategyKey}`);
  }

  const config = { ...strategyInfo.defaultConfig, ...customConfig };
  return new strategyInfo.class(config);
}

/**
 * Get all available strategies
 */
function getAvailableStrategies() {
  return Object.entries(strategyRegistry).map(([key, info]) => ({
    key,
    name: info.name,
    description: info.description,
    category: info.category,
    timeframe: info.timeframe,
    riskLevel: info.riskLevel,
    defaultConfig: info.defaultConfig
  }));
}

/**
 * Get strategy info by key
 */
function getStrategyInfo(strategyKey) {
  return strategyRegistry[strategyKey] || null;
}

module.exports = {
  TechnicalIndicators,
  VWAPStrategy,
  BollingerSqueezeStrategy,
  RSIDivergenceStrategy,
  ORBStrategy,
  GapFillStrategy,
  strategyRegistry,
  createStrategy,
  getAvailableStrategies,
  getStrategyInfo
};
