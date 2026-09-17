PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS staff_access (
  telegram_id TEXT PRIMARY KEY,
  employee_name TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by_telegram_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_access_active
  ON staff_access(active, employee_name);
