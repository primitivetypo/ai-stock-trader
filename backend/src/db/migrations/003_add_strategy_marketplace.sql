-- Migration: Add Strategy Marketplace
-- Created: 2025-11-24
-- Description: Adds tables for community-shared trading strategies

-- Shared Strategies Table
CREATE TABLE IF NOT EXISTS shared_strategies (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  strategy_key VARCHAR(100) NOT NULL, -- References strategies.js
  creator_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  creator_name VARCHAR(255),

  -- Performance metrics
  performance_7d DECIMAL(10,2),
  performance_30d DECIMAL(10,2),
  performance_90d DECIMAL(10,2),
  performance_1y DECIMAL(10,2),
  win_rate DECIMAL(5,2),
  sharpe_ratio DECIMAL(10,4),
  max_drawdown DECIMAL(10,2),

  -- Configuration
  config JSONB NOT NULL DEFAULT '{}',
  watchlist TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Risk & category
  risk_level VARCHAR(50) NOT NULL CHECK (risk_level IN ('Conservative', 'Moderate', 'Aggressive', 'Very Aggressive')),
  category VARCHAR(100),
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Popularity
  uses_count INTEGER DEFAULT 0,
  favorites_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_performance_update TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shared_strategies_strategy_key ON shared_strategies(strategy_key);
CREATE INDEX IF NOT EXISTS idx_shared_strategies_creator ON shared_strategies(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_strategies_category ON shared_strategies(category);
CREATE INDEX IF NOT EXISTS idx_shared_strategies_risk ON shared_strategies(risk_level);
CREATE INDEX IF NOT EXISTS idx_shared_strategies_uses ON shared_strategies(uses_count DESC);
CREATE INDEX IF NOT EXISTS idx_shared_strategies_performance ON shared_strategies(performance_30d DESC);
CREATE INDEX IF NOT EXISTS idx_shared_strategies_active ON shared_strategies(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_shared_strategies_featured ON shared_strategies(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_shared_strategies_tags ON shared_strategies USING GIN(tags);

-- Strategy Usage Tracking
CREATE TABLE IF NOT EXISTS strategy_uses (
  id SERIAL PRIMARY KEY,
  shared_strategy_id INTEGER REFERENCES shared_strategies(id) ON DELETE CASCADE,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  experiment_id VARCHAR(255),
  bot_id VARCHAR(255),
  used_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, shared_strategy_id, experiment_id)
);

CREATE INDEX IF NOT EXISTS idx_strategy_uses_strategy ON strategy_uses(shared_strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_uses_user ON strategy_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_uses_experiment ON strategy_uses(experiment_id);

-- Strategy Favorites
CREATE TABLE IF NOT EXISTS strategy_favorites (
  id SERIAL PRIMARY KEY,
  shared_strategy_id INTEGER REFERENCES shared_strategies(id) ON DELETE CASCADE,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  favorited_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, shared_strategy_id)
);

CREATE INDEX IF NOT EXISTS idx_strategy_favorites_strategy ON strategy_favorites(shared_strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_favorites_user ON strategy_favorites(user_id);

-- Strategy Reviews/Ratings
CREATE TABLE IF NOT EXISTS strategy_reviews (
  id SERIAL PRIMARY KEY,
  shared_strategy_id INTEGER REFERENCES shared_strategies(id) ON DELETE CASCADE,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  profit_achieved DECIMAL(10,2),
  time_used_days INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, shared_strategy_id)
);

CREATE INDEX IF NOT EXISTS idx_strategy_reviews_strategy ON strategy_reviews(shared_strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_reviews_rating ON strategy_reviews(rating DESC);

-- Function to update uses count
CREATE OR REPLACE FUNCTION update_strategy_uses_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE shared_strategies
  SET uses_count = (
    SELECT COUNT(DISTINCT user_id)
    FROM strategy_uses
    WHERE shared_strategy_id = NEW.shared_strategy_id
  )
  WHERE id = NEW.shared_strategy_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_strategy_uses_count
AFTER INSERT ON strategy_uses
FOR EACH ROW
EXECUTE FUNCTION update_strategy_uses_count();

-- Function to update favorites count
CREATE OR REPLACE FUNCTION update_strategy_favorites_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE shared_strategies
  SET favorites_count = (
    SELECT COUNT(*)
    FROM strategy_favorites
    WHERE shared_strategy_id = COALESCE(NEW.shared_strategy_id, OLD.shared_strategy_id)
  )
  WHERE id = COALESCE(NEW.shared_strategy_id, OLD.shared_strategy_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_strategy_favorites_count
AFTER INSERT OR DELETE ON strategy_favorites
FOR EACH ROW
EXECUTE FUNCTION update_strategy_favorites_count();

-- Seed with featured strategies
INSERT INTO shared_strategies (
  title, description, strategy_key, creator_name,
  risk_level, category, tags, config, watchlist,
  is_featured, is_verified,
  performance_7d, performance_30d, performance_90d,
  win_rate, uses_count
) VALUES
(
  'Conservative Dividend Growth',
  'Focus on stable, dividend-paying stocks with consistent growth. Low risk, steady returns.',
  'dividend-growth',
  'AI Trader Team',
  'Conservative',
  'Dividend',
  ARRAY['dividend', 'long-term', 'conservative', 'income'],
  '{"minDividendYield": 3, "minConsecutiveYears": 10, "maxPE": 20}',
  ARRAY['KO', 'JNJ', 'PG', 'PEP', 'MCD'],
  TRUE,
  TRUE,
  2.1, 8.5, 12.3,
  78.5, 1250
),
(
  'Tech Growth Momentum',
  'High-growth technology stocks using momentum indicators. Aggressive risk profile.',
  'momentum',
  'AI Trader Team',
  'Aggressive',
  'Technology',
  ARRAY['tech', 'growth', 'momentum', 'short-term'],
  '{"momentumPeriod": 20, "rsiThreshold": 70, "volumeMultiplier": 2}',
  ARRAY['NVDA', 'TSLA', 'AMD', 'PLTR', 'COIN'],
  TRUE,
  TRUE,
  5.2, 22.4, 35.8,
  65.2, 2840
),
(
  'AI News-Driven Trading',
  'Uses AI to analyze market news and sentiment for trading decisions. Powered by Gemini AI.',
  'ai-news-trader',
  'AI Trader Team',
  'Moderate',
  'AI-Powered',
  ARRAY['ai', 'news', 'sentiment', 'automated'],
  '{"newsConfidenceThreshold": 0.7, "maxTradesPerDay": 5}',
  ARRAY['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'],
  TRUE,
  TRUE,
  3.8, 15.6, 28.9,
  72.3, 985
),
(
  'Mean Reversion Master',
  'Identifies oversold/overbought conditions for contrarian trades. Moderate risk.',
  'mean-reversion',
  'AI Trader Team',
  'Moderate',
  'Technical',
  ARRAY['mean-reversion', 'technical', 'contrarian'],
  '{"rsiLow": 30, "rsiHigh": 70, "bbPeriod": 20}',
  ARRAY['SPY', 'QQQ', 'DIA', 'IWM'],
  TRUE,
  TRUE,
  2.8, 11.2, 19.5,
  68.9, 1567
),
(
  'Breakout Hunter',
  'Detects volume spikes and breakouts from consolidation patterns.',
  'volume-spike',
  'AI Trader Team',
  'Aggressive',
  'Technical',
  ARRAY['breakout', 'volume', 'technical', 'momentum'],
  '{"volumeThreshold": 2.5, "consolidationDays": 5}',
  ARRAY['AAPL', 'TSLA', 'NVDA', 'AMD', 'MSFT'],
  TRUE,
  TRUE,
  4.5, 18.7, 31.2,
  64.1, 2156
),
(
  'All-Weather Portfolio',
  'Balanced allocation across sectors for any market condition. Conservative approach.',
  'balanced',
  'AI Trader Team',
  'Conservative',
  'Diversified',
  ARRAY['diversified', 'balanced', 'all-weather', 'long-term'],
  '{"rebalanceFrequency": "monthly", "maxSectorAllocation": 0.25}',
  ARRAY['SPY', 'TLT', 'GLD', 'VNQ', 'BND'],
  TRUE,
  TRUE,
  1.9, 9.8, 14.6,
  75.8, 3420
);

-- Comments for documentation
COMMENT ON TABLE shared_strategies IS 'Community-shared trading strategies';
COMMENT ON TABLE strategy_uses IS 'Tracks which users are using which strategies';
COMMENT ON TABLE strategy_favorites IS 'User favorites for strategies';
COMMENT ON TABLE strategy_reviews IS 'User reviews and ratings for strategies';

COMMENT ON COLUMN shared_strategies.strategy_key IS 'References the actual strategy implementation in code';
COMMENT ON COLUMN shared_strategies.config IS 'Strategy-specific configuration parameters';
COMMENT ON COLUMN shared_strategies.is_verified IS 'Verified by platform team for quality';
COMMENT ON COLUMN shared_strategies.is_featured IS 'Featured on marketplace homepage';
