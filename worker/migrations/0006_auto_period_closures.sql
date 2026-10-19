-- The closure marker provides an idempotent write boundary without changing old payments.
CREATE TABLE IF NOT EXISTS automatic_period_closures (
  close_date TEXT PRIMARY KEY CHECK(length(close_date) = 10),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
