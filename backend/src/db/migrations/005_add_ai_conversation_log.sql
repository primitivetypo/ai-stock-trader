-- Migration: Add AI Conversation Log
-- Stores full AI prompts and responses for transparency

-- Add columns to ai_trade_reasoning to store full conversation
ALTER TABLE ai_trade_reasoning
  ADD COLUMN IF NOT EXISTS prompt TEXT,
  ADD COLUMN IF NOT EXISTS ai_response TEXT,
  ADD COLUMN IF NOT EXISTS function_calls JSONB,
  ADD COLUMN IF NOT EXISTS model_used VARCHAR(100),
  ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS token_count INTEGER;

-- Create AI Analysis Log table for detailed logging
CREATE TABLE IF NOT EXISTS ai_analysis_log (
  id SERIAL PRIMARY KEY,
  bot_id VARCHAR(255),
  experiment_id VARCHAR(255),
  news_article_id INTEGER REFERENCES ai_news_articles(id) ON DELETE SET NULL,

  -- Input
  prompt TEXT NOT NULL,
  news_headline TEXT,
  news_summary TEXT,
  symbols TEXT[],

  -- AI Processing
  model_used VARCHAR(100),
  function_calls JSONB,

  -- Output
  ai_response TEXT,
  decision VARCHAR(20), -- BUY, SELL, SKIP
  reasoning TEXT,
  confidence_score DECIMAL(5,2),
  sentiment VARCHAR(50),

  -- Trade details (if trade was made)
  trade_executed BOOLEAN DEFAULT FALSE,
  trade_symbol VARCHAR(20),
  trade_side VARCHAR(10),
  trade_qty INTEGER,
  trade_price DECIMAL(12,4),

  -- Metadata
  processing_time_ms INTEGER,
  token_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ai_log_bot ON ai_analysis_log(bot_id);
CREATE INDEX IF NOT EXISTS idx_ai_log_experiment ON ai_analysis_log(experiment_id);
CREATE INDEX IF NOT EXISTS idx_ai_log_created ON ai_analysis_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_log_decision ON ai_analysis_log(decision);
CREATE INDEX IF NOT EXISTS idx_ai_log_trade ON ai_analysis_log(trade_executed);

COMMENT ON TABLE ai_analysis_log IS 'Detailed log of all AI analysis including prompts and responses';
