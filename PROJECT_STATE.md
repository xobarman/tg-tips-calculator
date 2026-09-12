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
- Telegram bot token is configured in Cloudflare as a Worker secret via GitHub Actions and is not committed.
- GitHub Actions secrets currently configured by the user: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `TELEGRAM_BOT_TOKEN`, `ALLOWED_TELEGRAM_USER_IDS`.
- The dev Mini App authenticates Telegram `initData` server-side and uses explicit Telegram-ID allowlisting for history/save access.
- Employee selection supports: Александр, Александра, Анна, Арсик, Снежа; waiter 3 may be empty for a 2-person shift.
- Money is stored as integer kopecks; server-side code recalculates distributions.
- Real 2-person and 3-person Telegram scenarios have passed calculate -> save -> D1 -> history -> summary end-to-end.
- The polished dark UI and current-month counter have been manually checked inside Telegram.
- The month counter is derived from calendar-month data, so a new month starts at zero without deleting older records; prior months remain accessible through history.

## Daily lock / correction / payout rules
- The implementation from `feature/daily-lock-owner-payouts-v1` is now on `dev`.
- GitHub Actions tests and syntax checks pass on the feature and on `dev`.
- Cloudflare dev deployment passes; migration `0002_daily_lock_and_payments.sql` has been applied successfully.
- There is at most one active saved calculation per Moscow business date. The first allowed employee who saves locks that day for all other employees.
- Saving is restricted server-side to the current `Europe/Moscow` business date.
- Only the configured owner may replace the active calculation for the current day, and only before the Moscow date rolls over at 00:00. Replacement is atomic: the old row is deactivated for normal totals/history but retained as an audit row.
- Existing same-day DEV test duplicates were reduced to the newest active row per date for normal history/totals; older rows remain only as audit data.
- Actual cash payouts are stored in a separate D1 payment ledger. Only the owner may record a payout.
- Period/month balances use `distributed - paid`; the main monthly card and history summary show the remaining amount due after recorded payouts.
- The owner-only payout form lives in History, not on the primary calculation form. Its date determines which calendar month the payment reduces.
- CI syntax-checks both Worker and Mini App scripts and runs tests on feature branches as well as `dev`.

## Current blocker
Owner-specific actions are intentionally fail-closed because the GitHub Actions secret `OWNER_TELEGRAM_USER_ID` is not configured yet. The current `ALLOWED_TELEGRAM_USER_IDS` can later be expanded with each staff member's Telegram ID so staff can calculate/save while remaining unable to correct calculations or record payouts.

## NEXT_ACTION
Add `OWNER_TELEGRAM_USER_ID` in GitHub Actions Secrets using the owner's Telegram ID already shown by the DEV Mini App. Then trigger one dev deployment and manually verify: one-save-per-day lock -> owner replacement before 00:00 Moscow -> owner payout -> net balance subtraction.
