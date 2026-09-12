PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS calculations (
  id TEXT PRIMARY KEY,
  business_date TEXT NOT NULL CHECK(length(business_date) = 10),
  total_kopecks INTEGER NOT NULL CHECK(total_kopecks >= 0),
  morning_kopecks INTEGER NOT NULL CHECK(morning_kopecks >= 0),
  evening_kopecks INTEGER NOT NULL CHECK(evening_kopecks >= 0),
  fee_percent INTEGER NOT NULL DEFAULT 8 CHECK(fee_percent = 8),
  participant_count INTEGER NOT NULL CHECK(participant_count IN (2, 3)),
  created_by_telegram_id TEXT NOT NULL,
  created_by_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payouts (
  calculation_id TEXT NOT NULL REFERENCES calculations(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position IN (1, 2, 3)),
  amount_kopecks INTEGER NOT NULL CHECK(amount_kopecks >= 0),
  PRIMARY KEY (calculation_id, position)
);

CREATE INDEX IF NOT EXISTS idx_calculations_business_date ON calculations(business_date);
CREATE INDEX IF NOT EXISTS idx_payouts_employee_name ON payouts(employee_name);
