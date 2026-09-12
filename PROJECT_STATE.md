# PROJECT_STATE.md

## Current production
- Repository: `xobarman/tg-tips-calculator`.
- `main` is the live GitHub Pages Mini App already used by the Telegram bot.
- Production calculator has three numeric inputs and the original 3-person calculation.
- Production must remain unchanged while the new version is being built.

## Development
- `dev` is the isolated development branch; new bounded work may be prepared on short-lived feature branches before moving to `dev`.
- Cloudflare dev architecture is live: one Worker serves the test Mini App static assets plus `/api/*`, backed by D1. The current GitHub Pages production URL remains untouched.
- Dev Worker URL: `https://tg-tips-calculator-dev.xobarman.workers.dev`.
- A separate Telegram Direct Link Mini App for dev exists under the current bot; the existing Main App and Menu Button remain unchanged.
- D1 database `tg-tips-calculator-dev` exists.
- Telegram bot token and owner Telegram ID are configured in Cloudflare as Worker secrets via GitHub Actions and are not committed.
- GitHub Actions secrets configured by the user: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `TELEGRAM_BOT_TOKEN`, `ALLOWED_TELEGRAM_USER_IDS`, `OWNER_TELEGRAM_USER_ID`.
- `ALLOWED_TELEGRAM_USER_IDS` now includes the owner plus at least one additional staff account for role verification; individual Telegram IDs are not stored in the repository.
- The dev Mini App authenticates Telegram `initData` server-side and uses explicit Telegram-ID allowlisting for history/save access.
- Employee selection supports: Александр, Александра, Анна, Арсик, Снежа; waiter 3 may be empty for a 2-person shift.
- Money is stored as integer kopecks; server-side code recalculates distributions.
- Real 2-person and 3-person Telegram scenarios have passed calculate -> save -> D1 -> history -> summary end-to-end.
- The polished dark UI and current-month counter have been manually checked inside Telegram.
- The month counter is derived from calendar-month data, so a new month starts at zero without deleting older records; prior months remain accessible through history.

## Daily lock / correction / payout rules
- There is at most one active saved calculation per Moscow business date. The first allowed employee who saves locks that day for all other employees.
- A normal allowed employee may create the first save only for the current `Europe/Moscow` business date.
- The employee who originally locked/saved that day may replace the active calculation until 00:00 Moscow. This original submitter identity is stored separately and survives later corrections.
- The configured owner may replace an existing active calculation for any current or past business date at any time.
- Owner corrections do not remove the original submitter's right to make another same-day correction before 00:00.
- Replacement is atomic: the old row is deactivated for normal totals/history but retained as an audit row.
- Migration `0003_day_submitter.sql` preserves/backfills the original day submitter identity for existing calculations.
- Actual cash payouts are stored in a separate D1 payment ledger. Only the owner may record a payout.
- Period/month balances use `distributed - paid`; the main monthly card and history summary show the remaining amount due after recorded payouts.
- The owner-only payout form lives in History, not on the primary calculation form. Its date determines which calendar month the payment reduces.
- The owner can select past dates in the calculation form for correcting an existing historical calculation; staff remain locked to the current Moscow date.
- CI syntax-checks both Worker and Mini App scripts and runs calculation tests.
- Latest GitHub Actions tests pass, Cloudflare dev deployment passes, migration `0003` is applied, and the owner secret configuration step completed successfully.
- Manual Telegram verification confirms the owner identity is active (`владелец` shown in DEV), the owner can save an исправление for today's locked calculation, and the corrected result replaces the active totals while the app remains in DEV.

## Current blocker
No infrastructure blocker. The updated allowlist must be propagated by a fresh DEV deployment, then the additional staff account must manually verify it can open protected DEV data but cannot replace the already-locked current day when it is not the original submitter. Verification that a normal employee can replace a day they originally submitted still requires a day first saved by that employee (naturally on the next suitable test day, unless the DEV day is deliberately reset). The owner payout flow also still needs one manual check that a recorded payout reduces the employee's outstanding monthly balance correctly.

## NEXT_ACTION
Redeploy DEV with the updated allowlist. Then have the additional staff account reopen the DEV Mini App and verify access plus the lock on today's owner-submitted calculation. After that, record one small owner-only payout and confirm the monthly outstanding balance is reduced by exactly that amount.
