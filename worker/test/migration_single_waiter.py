"""SQLite migration regression: historical tip and payout data must survive rebuild."""
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "migrations"


def check(condition, message):
    if not condition:
        raise AssertionError(message)


conn = sqlite3.connect(":memory:", isolation_level=None)
conn.row_factory = sqlite3.Row
conn.execute("PRAGMA foreign_keys = ON")
for number in range(1, 7):
    (migration,) = sorted(MIGRATIONS.glob(f"{number:04d}_*.sql"))
    conn.executescript(migration.read_text(encoding="utf-8"))

# Sample old same-day correction, owner payment, access, auto-closure marker.
conn.execute("""INSERT INTO calculations
  (id, business_date, total_kopecks, morning_kopecks, evening_kopecks,
   participant_count, created_by_telegram_id, created_by_name, created_at,
   is_active, replaced_at, replaced_by_telegram_id, day_submitter_telegram_id)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
    ("old", "2026-10-17", 300000, 0, 0, 2, "1001", "Сотрудник",
     "2026-10-17 22:00:00", 0, "2026-10-17 23:00:00", "2001", "1001"))
conn.execute("""INSERT INTO calculations
  (id, business_date, total_kopecks, morning_kopecks, evening_kopecks,
   participant_count, created_by_telegram_id, created_by_name, created_at,
   is_active, replaced_at, replaced_by_telegram_id, day_submitter_telegram_id)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
    ("new", "2026-10-17", 320000, 0, 0, 2, "2001", "Владелец",
     "2026-10-17 23:00:00", 1, None, None, "1001"))
conn.executemany("INSERT INTO payouts VALUES (?, ?, ?, ?)", [
    ("old", "Анна", 1, 138000), ("old", "Снежа", 2, 138000),
    ("new", "Анна", 1, 147200), ("new", "Снежа", 2, 147200),
])
conn.execute("""INSERT INTO payments
 (id, business_date, employee_name, amount_kopecks,
  created_by_telegram_id, created_by_name)
 VALUES ('pay-1', '2026-10-18', 'Анна', 100000, '2001', 'Владелец')""")
conn.execute("""INSERT INTO staff_access
 (telegram_id, employee_name, active, can_correct, updated_by_telegram_id)
 VALUES ('1001', 'Анна', 1, 1, '2001')""")
conn.execute("INSERT INTO automatic_period_closures (close_date) VALUES ('2026-10-31')")

tables = ["calculations", "payouts", "payments", "staff_access", "automatic_period_closures"]


def snapshot(table):
    return sorted(tuple(row) for row in conn.execute(f"SELECT * FROM {table}"))


before = {t: snapshot(t) for t in tables}
check(not conn.execute("PRAGMA foreign_key_check").fetchall(), "Invalid before migration")
conn.executescript((MIGRATIONS / "0007_allow_single_waiter.sql").read_text(encoding="utf-8"))
after = {t: snapshot(t) for t in tables}
check(before == after, "Historical D1 records changed during migration")
check(not conn.execute("PRAGMA foreign_key_check").fetchall(), "Foreign key mismatch after migration")

# Confirm preserved old indexes and FK, with no altered historical counts.
indexes = {row["name"] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='index'")}
check({"idx_calculations_business_date", "idx_calculations_one_active_day",
       "idx_payouts_employee_name"} <= indexes, "Financial indexes missing")
refs = list(conn.execute("PRAGMA foreign_key_list(payouts)"))
check(len(refs) == 1 and refs[0]["table"] == "calculations"
      and refs[0]["on_delete"] == "CASCADE", "Payout FK did not survive")

# New single-person record and its one payout can be saved.
conn.execute("""INSERT INTO calculations
  (id, business_date, total_kopecks, morning_kopecks, evening_kopecks,
   participant_count, created_by_telegram_id, day_submitter_telegram_id)
  VALUES ('single', '2026-10-19', 293300, 0, 0, 1, '2001', '2001')""")
conn.execute("INSERT INTO payouts VALUES ('single', 'Анна', 1, 269836)")
check(conn.execute("SELECT participant_count FROM calculations WHERE id='single'").fetchone()[0] == 1,
      "Single-waiter calculation not stored")
check(conn.execute("SELECT amount_kopecks FROM payouts WHERE calculation_id='single'").fetchone()[0] == 269836,
      "One-person payout missing")

# Existing one-active-day and participant-count constraints remain effective.
for invalid in [0, 4]:
    try:
        conn.execute("""INSERT INTO calculations
          (id, business_date, total_kopecks, morning_kopecks, evening_kopecks,
           participant_count, created_by_telegram_id)
          VALUES (?, '2026-10-20', 100, 0, 0, ?, '2001')""", (f"invalid-{invalid}", invalid))
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError(f"Invalid participant count {invalid} accepted")
try:
    conn.execute("""INSERT INTO calculations
      (id, business_date, total_kopecks, morning_kopecks, evening_kopecks,
       participant_count, created_by_telegram_id)
      VALUES ('duplicate', '2026-10-19', 100, 0, 0, 1, '2001')""")
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("One-active-calculation-per-date constraint lost")

conn.execute("DELETE FROM calculations WHERE id='single'")
check(conn.execute("SELECT COUNT(*) FROM payouts WHERE calculation_id='single'").fetchone()[0] == 0,
      "ON DELETE CASCADE not retained")
check({t: snapshot(t) for t in tables if t != "calculations" and t != "payouts"} ==
      {t: before[t] for t in tables if t != "calculations" and t != "payouts"},
      "Unrelated financial or staff data changed")
check(not conn.execute("PRAGMA foreign_key_check").fetchall(), "Invalid FK after post-migration writes")
print("PASS: historical calculations, payout references, payments, staff, closures, indexes, constraints and solo save")
