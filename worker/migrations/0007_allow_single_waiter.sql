-- Allow one waiter in a saved calculation. Preserve all history and payouts.
-- D1 cannot turn off foreign-key cascades within its implicit transaction.
-- Copy BOTH related tables into new FK-linked tables before dropping either original.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE calculations_0007 (
  id TEXT PRIMARY KEY,
  business_date TEXT NOT NULL CHECK(length(business_date) = 10),
  total_kopecks INTEGER NOT NULL CHECK(total_kopecks >= 0),
  morning_kopecks INTEGER NOT NULL CHECK(morning_kopecks >= 0),
  evening_kopecks INTEGER NOT NULL CHECK(evening_kopecks >= 0),
  fee_percent INTEGER NOT NULL DEFAULT 8 CHECK(fee_percent = 8),
  participant_count INTEGER NOT NULL CHECK(participant_count IN (1, 2, 3)),
  created_by_telegram_id TEXT NOT NULL,
  created_by_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  replaced_at TEXT,
  replaced_by_telegram_id TEXT,
  day_submitter_telegram_id TEXT
);

INSERT INTO calculations_0007 (
  id, business_date, total_kopecks, morning_kopecks, evening_kopecks,
  fee_percent, participant_count, created_by_telegram_id, created_by_name,
  created_at, is_active, replaced_at, replaced_by_telegram_id, day_submitter_telegram_id
)
SELECT
  id, business_date, total_kopecks, morning_kopecks, evening_kopecks,
  fee_percent, participant_count, created_by_telegram_id, created_by_name,
  created_at, is_active, replaced_at, replaced_by_telegram_id, day_submitter_telegram_id
FROM calculations;

-- The copied child table points ONLY to the new parent, so dropping the
-- original calculations table cannot cascade-delete copied payouts.
CREATE TABLE payouts_0007 (
  calculation_id TEXT NOT NULL REFERENCES calculations_0007(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position IN (1, 2, 3)),
  amount_kopecks INTEGER NOT NULL CHECK(amount_kopecks >= 0),
  PRIMARY KEY (calculation_id, position)
);

INSERT INTO payouts_0007 (calculation_id, employee_name, position, amount_kopecks)
SELECT calculation_id, employee_name, position, amount_kopecks FROM payouts;

DROP TABLE payouts;
DROP TABLE calculations;

-- SQLite automatically updates the new child foreign key on parent rename.
ALTER TABLE calculations_0007 RENAME TO calculations;
ALTER TABLE payouts_0007 RENAME TO payouts;

CREATE INDEX idx_calculations_business_date ON calculations(business_date);
CREATE UNIQUE INDEX idx_calculations_one_active_day
  ON calculations(business_date) WHERE is_active = 1;
CREATE INDEX idx_payouts_employee_name ON payouts(employee_name);

PRAGMA foreign_key_check;
PRAGMA defer_foreign_keys = OFF;
