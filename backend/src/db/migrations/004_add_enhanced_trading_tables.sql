-- Migration 004: Enhanced Trading Tables
-- Adds tables for sentiment analysis, AI learning, and risk management

-- Sentiment data storage
CREATE TABLE IF NOT EXISTS sentiment_data (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  source VARCHAR(50) NOT NULL,
  sentiment_score DECIMAL(5,3),
  volume INTEGER DEFAULT 0,
  data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentiment_symbol ON sentiment_data(symbol);
CREATE INDEX IF NOT EXISTS idx_sentiment_created ON sentiment_data(created_at);
CREATE INDEX IF NOT EXISTS idx_sentiment_symbol_created ON sentiment_data(symbol, created_at);

-- AI trade outcomes for learning
CREATE TABLE IF NOT EXISTS ai_trade_outcomes (
  id SERIAL PRIMARY KEY,
  bot_id VARCHAR(100) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  side VARCHAR(10) NOT NULL,
  entry_price DECIMAL(12,4) NOT NULL,
  exit_price DECIMAL(12,4) NOT NULL,
  qty INTEGER NOT NULL,
  pnl DECIMAL(12,2) NOT NULL,
  pnl_percent DECIMAL(8,4) NOT NULL,
  holding_time_hours DECIMAL(10,2),
  is_winner BOOLEAN NOT NULL,
  strategy VARCHAR(100),
  news_article_id INTEGER,
  reasoning TEXT,
  confidence DECIMAL(5,2),
  market_conditions JSONB,
  entry_time TIMESTAMP NOT NULL,
  exit_time TIMESTAMP NOT NULL,
  recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_bot ON ai_trade_outcomes(bot_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_strategy ON ai_trade_outcomes(strategy);
CREATE INDEX IF NOT EXISTS idx_outcomes_symbol ON ai_trade_outcomes(symbol);
CREATE INDEX IF NOT EXISTS idx_outcomes_recorded ON ai_trade_outcomes(recorded_at);

-- Trade signals (before execution)
CREATE TABLE IF NOT EXISTS trade_signals (
  id SERIAL PRIMARY KEY,
  strategy VARCHAR(100) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  direction VARCHAR(10) NOT NULL,
  confidence DECIMAL(5,2),
  signal_data JSONB,
  executed BOOLEAN DEFAULT FALSE,
  execution_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_strategy ON trade_signals(strategy);
CREATE INDEX IF NOT EXISTS idx_signals_symbol ON trade_signals(symbol);
CREATE INDEX IF NOT EXISTS idx_signals_created ON trade_signals(created_at);

-- Strategy configurations
CREATE TABLE IF NOT EXISTS strategy_configs (
  id SERIAL PRIMARY KEY,
  strategy_name VARCHAR(100) NOT NULL UNIQUE,
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Backtesting results
CREATE TABLE IF NOT EXISTS backtest_results (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  strategy VARCHAR(100) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  initial_capital DECIMAL(12,2) NOT NULL,
  final_capital DECIMAL(12,2) NOT NULL,
  total_trades INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2),
  sharpe_ratio DECIMAL(6,3),
  max_drawdown DECIMAL(5,2),
  profit_factor DECIMAL(8,3),
  results JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backtest_user ON backtest_results(user_id);
CREATE INDEX IF NOT EXISTS idx_backtest_strategy ON backtest_results(strategy);

-- User alerts configuration
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  alert_type VARCHAR(50) NOT NULL,
  symbol VARCHAR(10),
  condition JSONB NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  triggered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_symbol ON alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_alerts_enabled ON alerts(enabled);

-- Portfolio risk snapshots
CREATE TABLE IF NOT EXISTS portfolio_risk_snapshots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  portfolio_value DECIMAL(14,2) NOT NULL,
  var_95 DECIMAL(8,4),
  var_99 DECIMAL(8,4),
  max_drawdown DECIMAL(8,4),
  current_drawdown DECIMAL(8,4),
  sharpe_ratio DECIMAL(6,3),
  beta DECIMAL(6,3),
  risk_score INTEGER,
  position_count INTEGER,
  sector_exposure JSONB,
  alerts JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_user ON portfolio_risk_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_created ON portfolio_risk_snapshots(created_at);

-- AI learning metrics (weekly summaries)
CREATE TABLE IF NOT EXISTS ai_learning_metrics (
  id SERIAL PRIMARY KEY,
  bot_id VARCHAR(100),
  strategy VARCHAR(100),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_trades INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2),
  profit_factor DECIMAL(8,3),
  avg_confidence DECIMAL(5,2),
  confidence_correlation DECIMAL(5,3),
  best_symbol VARCHAR(10),
  worst_symbol VARCHAR(10),
  recommendations JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_bot ON ai_learning_metrics(bot_id);
CREATE INDEX IF NOT EXISTS idx_learning_period ON ai_learning_metrics(period_start);

-- Add sentiment column to ai_news_articles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_news_articles' AND column_name = 'sentiment'
  ) THEN
    ALTER TABLE ai_news_articles ADD COLUMN sentiment DECIMAL(5,3);
  END IF;
END $$;

-- Add provider column to ai_news_articles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_news_articles' AND column_name = 'provider'
  ) THEN
    ALTER TABLE ai_news_articles ADD COLUMN provider VARCHAR(50);
  END IF;
END $$;

-- Add category column to bots if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bots' AND column_name = 'strategy_category'
  ) THEN
    ALTER TABLE bots ADD COLUMN strategy_category VARCHAR(50);
  END IF;
END $$;

-- Insert default strategy configurations
INSERT INTO strategy_configs (strategy_name, config) VALUES
  ('volume-spike', '{"volumeThreshold": 2.0, "supportDistance": 0.02, "resistanceTarget": 0.03, "stopLoss": 0.02, "positionSize": 0.1}'),
  ('momentum', '{"fastMA": 5, "slowMA": 20, "profitTarget": 0.05, "stopLoss": 0.025, "positionSize": 0.15}'),
  ('mean-reversion', '{"rsiPeriod": 14, "oversoldLevel": 30, "overboughtLevel": 70, "profitTarget": 0.03, "stopLoss": 0.02, "positionSize": 0.12}'),
  ('breakout', '{"breakoutThreshold": 0.015, "volumeConfirmation": 1.5, "profitTarget": 0.06, "stopLoss": 0.03, "positionSize": 0.08}'),
  ('support-resistance', '{"supportTolerance": 0.005, "resistanceTolerance": 0.005, "profitTarget": 0.04, "stopLoss": 0.015, "positionSize": 0.1}'),
  ('vwap', '{"vwapDeviation": 0.01, "volumeThreshold": 1.2, "profitTarget": 0.02, "stopLoss": 0.015, "positionSize": 0.1}'),
  ('bollinger-squeeze', '{"bbPeriod": 20, "bbStdDev": 2, "kcPeriod": 20, "kcAtrMultiplier": 1.5, "profitTarget": 0.04, "stopLoss": 0.02, "positionSize": 0.08}'),
  ('rsi-divergence', '{"rsiPeriod": 14, "divergenceLookback": 20, "profitTarget": 0.035, "stopLoss": 0.02, "positionSize": 0.1}'),
  ('orb', '{"openingRangeMinutes": 30, "volumeConfirmation": 1.2, "maxRangePercent": 0.02, "profitTarget": 0.015, "positionSize": 0.1}'),
  ('gap-fill', '{"minGapPercent": 0.01, "maxGapPercent": 0.05, "gapFillTarget": 1.0, "stopLoss": 0.02, "positionSize": 0.08}'),
  ('ai-news-trader', '{"confidenceThreshold": 70, "maxNewsPerHour": 50, "positionSize": 0.1}')
ON CONFLICT (strategy_name) DO UPDATE SET config = EXCLUDED.config, updated_at = NOW();

COMMENT ON TABLE sentiment_data IS 'Stores sentiment scores from various sources for each symbol';
COMMENT ON TABLE ai_trade_outcomes IS 'Records trade outcomes for AI learning and performance analysis';
COMMENT ON TABLE trade_signals IS 'Stores trading signals generated by strategies before execution';
COMMENT ON TABLE strategy_configs IS 'Centralized configuration for all trading strategies';
COMMENT ON TABLE backtest_results IS 'Stores results of strategy backtests';
COMMENT ON TABLE alerts IS 'User-configured price and technical alerts';
COMMENT ON TABLE portfolio_risk_snapshots IS 'Point-in-time portfolio risk metrics';
COMMENT ON TABLE ai_learning_metrics IS 'Weekly AI performance summaries for improvement tracking';
