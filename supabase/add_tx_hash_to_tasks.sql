-- Add tx_hash column to tasks for storing the WPT reward transaction hash
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS tx_hash TEXT DEFAULT NULL;

