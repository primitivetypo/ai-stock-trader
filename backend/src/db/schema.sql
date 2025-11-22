-- AI Stock Trader Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Virtual Portfolios table
CREATE TABLE IF NOT EXISTS portfolios (
  user_id VARCHAR(255) PRIMARY KEY,
  cash DECIMAL(12,2) NOT NULL DEFAULT 100000.00,
  last_equity DECIMAL(12,2) DEFAULT 100000.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  qty INTEGER NOT NULL,
  side VARCHAR(10) NOT NULL,
  avg_entry_price DECIMAL(10,4) NOT NULL,
  market_value DECIMAL(12,2),
  cost_basis DECIMAL(12,2),
  unrealized_pl DECIMAL(12,2),
  unrealized_plpc DECIMAL(10,4),
  current_price DECIMAL(10,4),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, symbol)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  qty INTEGER NOT NULL,
  side VARCHAR(10) NOT NULL,
  type VARCHAR(20) NOT NULL,
  time_in_force VARCHAR(10) DEFAULT 'gtc',
  limit_price DECIMAL(10,4),
  stop_price DECIMAL(10,4),
  status VARCHAR(20) NOT NULL,
  filled_qty INTEGER DEFAULT 0,
  filled_avg_price DECIMAL(10,4),
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  filled_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  failed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Experiments table
CREATE TABLE IF NOT EXISTS experiments (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  bot_count INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'created',
  watchlist JSONB,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_experiments_user_id ON experiments(user_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);

-- Bots table
CREATE TABLE IF NOT EXISTS bots (
  id VARCHAR(255) PRIMARY KEY,
  experiment_id VARCHAR(255) NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  strategy_key VARCHAR(50) NOT NULL,
  strategy_name VARCHAR(255) NOT NULL,
  config JSONB NOT NULL,
  watchlist JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'idle',
  start_time TIMESTAMP,
  stop_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bots_experiment_id ON bots(experiment_id);
CREATE INDEX IF NOT EXISTS idx_bots_status ON bots(status);

-- Bot Metrics table
CREATE TABLE IF NOT EXISTS bot_metrics (
  bot_id VARCHAR(255) PRIMARY KEY REFERENCES bots(id) ON DELETE CASCADE,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  total_profit DECIMAL(12,2) DEFAULT 0,
  current_equity DECIMAL(12,2) DEFAULT 100000.00,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bot Trades table
CREATE TABLE IF NOT EXISTS bot_trades (
  id SERIAL PRIMARY KEY,
  bot_id VARCHAR(255) NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  time TIMESTAMP NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  side VARCHAR(10) NOT NULL,
  qty INTEGER NOT NULL,
  price DECIMAL(10,4) NOT NULL,
  reason TEXT,
  order_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bot_trades_bot_id ON bot_trades(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_trades_time ON bot_trades(time);

-- Price History table (for bot analysis)
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  bot_id VARCHAR(255) NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  symbol VARCHAR(10) NOT NULL,
  prices JSONB NOT NULL,
  volumes JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bot_id, symbol)
);

-- Demo user (for development)
INSERT INTO users (id, email, name, password, created_at)
VALUES (
  'demo-user-1',
  'demo@demo.com',
  'Demo User',
  '$2a$10$YourHashedPasswordHere',
  CURRENT_TIMESTAMP
) ON CONFLICT (email) DO NOTHING;

-- Create demo user portfolio
INSERT INTO portfolios (user_id, cash, last_equity)
VALUES (
  'demo-user-1',
  100000.00,
  100000.00
) ON CONFLICT (user_id) DO NOTHING;
