PRAGMA foreign_keys = ON;

ALTER TABLE calculations ADD COLUMN day_submitter_telegram_id TEXT;

-- Preserve the identity of the employee who originally locked the business day.
-- This identity survives later corrections, including owner corrections.
UPDATE calculations
SET day_submitter_telegram_id = created_by_telegram_id
WHERE day_submitter_telegram_id IS NULL OR day_submitter_telegram_id = '';
