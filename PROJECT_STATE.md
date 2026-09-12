# PROJECT_STATE.md

## Current production
- Repository: `xobarman/tg-tips-calculator`.
- `main` is the live GitHub Pages Mini App already used by the Telegram bot.
- Production calculator has three numeric inputs and the original 3-person calculation.
- Production must remain unchanged until the user explicitly approves the production cutover.
- Planned production release/cutover: 15 September 2026, after the previous real tip calculation is completed.

## Development
- `dev` is the isolated development branch; new bounded work may be prepared on short-lived feature branches before moving to `dev`.
- Cloudflare dev architecture is live: one Worker serves the test Mini App static assets plus `/api/*`, backed by D1. The current GitHub Pages production URL remains untouched.
- Dev Worker URL: `https://tg-tips-calculator-dev.xobarman.workers.dev`.
- A separate Telegram Direct Link Mini App for dev exists under the current bot; the existing Main App and Menu Button remain unchanged.
- D1 database `tg-tips-calculator-dev` exists.
- Telegram bot token and owner Telegram ID are configured in Cloudflare as Worker secrets via GitHub Actions and are not committed.
- GitHub Actions secrets configured by the user: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `TELEGRAM_BOT_TOKEN`, `ALLOWED_TELEGRAM_USER_IDS`, `OWNER_TELEGRAM_USER_ID`.
- `ALLOWED_TELEGRAM_USER_IDS` includes the owner plus at least one additional staff account; individual Telegram IDs are not stored in the repository.
- The dev Mini App authenticates Telegram `initData` server-side and uses explicit Telegram-ID allowlisting for history/save access.
- Employee selection supports: Александр, Александра, Анна, Арсик, Снежа; waiter 3 may be empty for a 2-person shift.
- Money is stored as integer kopecks; server-side code recalculates distributions.
- Real 2-person and 3-person Telegram scenarios have passed calculate -> save -> D1 -> history -> summary end-to-end.
- The polished dark UI and current-month counter have been manually checked inside Telegram.
- The month counter is derived from calendar-month data, so a new month starts at zero without deleting older records; prior months remain accessible through history.
- Branding is now `Encore Café City · Чаевые` with the header developer mark `by Novikov Development`.
- The top `Расчёт` / `История` emoji were replaced by minimal line SVG icons for a cleaner UI.

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
- Manual Telegram verification confirms the owner identity is active (`владелец` shown in DEV), the owner can save a correction for today's locked calculation, and corrected totals replace the active row.
- Manual Telegram verification with an additional staff account confirms that the staff account can open protected DEV data, is not marked as owner, and cannot replace the current day when that day was locked by another user.
- Manual UI verification also shows recorded owner payouts being subtracted from the current-month outstanding balance.

## Current blocker
No infrastructure blocker. The only remaining role edge case that has not yet been observed naturally is a normal employee first saving a fresh day and then replacing their own same-day calculation before 00:00. Production cutover is intentionally deferred until 15 September 2026 after the previous real tip calculation.

## NEXT_ACTION
Open the refreshed DEV Mini App and visually verify the final branding/icon polish (`Encore Café City`, `by Novikov Development`, new line icons). Keep `main` unchanged. On 15 September after the previous real calculation, perform the production-readiness/cutover check and only then switch the bot/Main App to the tested production build with explicit user approval.
