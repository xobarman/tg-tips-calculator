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

## New daily lock / correction / payout rules
- A bounded implementation is prepared on `feature/daily-lock-owner-payouts-v1`; feature-branch tests and syntax checks pass.
- There is at most one active saved calculation per Moscow business date. The first allowed employee who saves locks that day for all other employees.
- Saving is restricted server-side to the current `Europe/Moscow` business date.
- Only the configured owner may replace the active calculation for the current day, and only before the Moscow date rolls over at 00:00. Replacement is atomic: the old row is deactivated for normal totals/history but retained as an audit row.
- Actual cash payouts are stored in a separate D1 payment ledger. Only the owner may record a payout.
- Period/month balances now use `distributed - paid`; the main monthly card and history summary show the remaining amount due after recorded payouts.
- An owner-only payout form is placed in History, not on the primary calculation form. Its date determines which calendar month the payment reduces.
- Migration `0002_daily_lock_and_payments.sql` adds active-row locking/audit fields, deduplicates existing same-day dev test rows to the newest active row, creates the one-active-day unique index, and adds the payments ledger.
- CI now syntax-checks both Worker and Mini App scripts and runs tests on feature branches as well as `dev`.

## Current blocker
The owner-specific actions are intentionally fail-closed until a new GitHub Actions secret `OWNER_TELEGRAM_USER_ID` is configured. The current `ALLOWED_TELEGRAM_USER_IDS` can later be expanded with each staff member's Telegram ID so staff can calculate/save while remaining unable to correct calculations or record payouts.

## NEXT_ACTION
Move the tested feature branch to `dev` and let Cloudflare apply migration `0002`/deploy the fail-closed owner-role implementation. Then add `OWNER_TELEGRAM_USER_ID` in GitHub Actions Secrets using the owner's Telegram ID already shown by the DEV Mini App, redeploy, and manually verify: one-save-per-day lock -> owner replacement before 00:00 Moscow -> owner payout -> net balance subtraction.
