# PROJECT_STATE.md

## Current production
- Repository: `xobarman/tg-tips-calculator`.
- Live Telegram Mini App uses Cloudflare Worker production: `https://tg-tips-calculator.xobarman.workers.dev`.
- Telegram Menu Button and Main App point to the Cloudflare production URL.
- Production D1 is separate from DEV and must never receive DEV/test data.
- Production is currently on `main` commit `631927a5a4f50f4d4db0b6d39e52dc7c25830395`.
- Production already includes the verified audit-history release.

## Production functionality
- Branding: `Encore Café City · Чаевые`, developer mark `by Novikov Development`.
- Employee selection: Александр, Александра, Анна, Арсик, Снежа; waiter 3 may be empty for a 2-person shift.
- Money is stored and calculated as integer kopecks; server-side code recalculates distributions.
- Commission is 8%.
- Telegram `initData` is validated server-side.
- Current production staff access still uses the existing Telegram user-ID allowlist mechanism.
- Production UI exposes the current Telegram ID for onboarding without requiring bot commands.
- Month balance is `distributed - paid`; new calendar months start at zero while old history remains stored.

## Daily lock / correction / payout rules
- There is at most one active saved calculation per Moscow business date.
- The first allowed employee who saves locks that day for other employees.
- The original submitter may replace the current-day calculation until 00:00 `Europe/Moscow`.
- The configured owner may replace an existing current or historical calculation at any time.
- Replaced rows remain as an audit trail but do not affect active history, counters, or balances.
- Actual employee payouts are stored separately from calculations.
- Only the configured owner may record payouts.
- Payment history stores who recorded each payout.

## Verified DEV release candidate: D1 staff access
- `dev` deploys to `https://tg-tips-calculator-dev.xobarman.workers.dev` and uses the isolated `tg-tips-calculator-dev` D1 database.
- A private Telegram Beta Direct Link points to the DEV Worker.
- The D1 staff-access implementation is present on `dev`.
- Migration `worker/migrations/0004_staff_access.sql` creates the `staff_access` table.
- `OWNER_TELEGRAM_USER_ID` remains a secret and owner access is handled separately.
- Staff access is keyed by Telegram ID, not username or display name.
- Owner-only UI supports assigning an employee name, adding/updating access, and disabling access without deleting the historical record.
- Legacy `ALLOWED_TELEGRAM_USER_IDS` remains only as a temporary fallback for IDs that do not yet have a D1 row, allowing a safe migration.
- A D1 row takes precedence over the legacy allowlist for that Telegram ID.
- `staff-access-ui.js` is included in the DEV static deployment after the packaging fix in commit `4c6452b22a1cbc0755eb8c165a89a24cc6a78a0d`.
- On 2026-09-17 the owner manually verified the Beta UI in Telegram and confirmed that adding/updating employee access through D1 works.

## Current blocker
Production promotion of D1 staff access is waiting for explicit owner approval. `main` must not be changed without that approval.

## NEXT_ACTION
Get explicit owner approval to promote the verified D1 staff-access release candidate from `dev` to `main`/production.
