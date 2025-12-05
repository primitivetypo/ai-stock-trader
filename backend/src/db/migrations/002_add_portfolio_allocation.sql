-- Migration: Add portfolio allocation to experiments
-- This allows multiple experiments to run concurrently with allocated cash limits

-- Add portfolio allocation columns to experiments table
ALTER TABLE experiments
ADD COLUMN IF NOT EXISTS allocated_cash DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS used_cash DECIMAL(12,2) DEFAULT 0;

-- Update existing experiments to have 0 used cash
UPDATE experiments SET used_cash = 0 WHERE used_cash IS NULL;

-- Add index for faster queries on active experiments
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_user_status ON experiments(user_id, status);
