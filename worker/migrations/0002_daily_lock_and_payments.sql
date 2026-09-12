PRAGMA foreign_keys = ON;

ALTER TABLE calculations ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1));
ALTER TABLE calculations ADD COLUMN replaced_at TEXT;
ALTER TABLE calculations ADD COLUMN replaced_by_telegram_id TEXT;

-- The dev database already contains several same-day test rows. Keep only the
-- newest row active for each business date; older rows remain as an audit trail.
UPDATE calculations
SET is_active = 0
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY business_date
             ORDER BY datetime(created_at) DESC, rowid DESC
           ) AS rn
    FROM calculations
  ) ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calculations_one_active_day
  ON calculations(business_date)
  WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  business_date TEXT NOT NULL CHECK(length(business_date) = 10),
  employee_name TEXT NOT NULL,
  amount_kopecks INTEGER NOT NULL CHECK(amount_kopecks > 0),
  created_by_telegram_id TEXT NOT NULL,
  created_by_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_business_date ON payments(business_date);
CREATE INDEX IF NOT EXISTS idx_payments_employee_name ON payments(employee_name);
