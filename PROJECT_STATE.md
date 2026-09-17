# PROJECT_STATE.md

## Current production
- Repository: `xobarman/tg-tips-calculator`.
- Live Telegram Mini App uses Cloudflare Worker production: `https://tg-tips-calculator.xobarman.workers.dev`.
- Telegram Menu Button and Main App point to the Cloudflare production URL.
- Production D1 is separate from DEV and must remain isolated from DEV/test data.
- Current production before the staff-access promotion is `main` at `631927a`.

## Production functionality
- Branding: `Encore Café City · Чаевые`, developer mark `by Novikov Development`.
- Employee selection: Александр, Александра, Анна, Арсик, Снежа; waiter 3 may be empty for a 2-person shift.
- Money is stored and calculated as integer kopecks; server-side code recalculates distributions.
- Commission is 8%.
- Telegram `initData` is validated server-side.
- Month balance is `distributed - paid`; new calendar months start at zero while old history remains stored.
- Daily lock, correction, audit history, and owner-only payouts are live in production.

## Daily lock / correction / payout rules
- There is at most one active saved calculation per Moscow business date.
- The first allowed employee who saves locks that day for other employees.
- The original submitter may replace the current-day calculation until 00:00 `Europe/Moscow`.
- The configured owner may replace an existing current or historical calculation at any time.
- Replaced rows remain as an audit trail but do not affect active history, counters, or balances.
- Actual employee payouts are stored separately from calculations.
- Only the configured owner may record payouts.
- Payment history stores who recorded each payout.

## Staff access release candidate
- `dev` deploys to `https://tg-tips-calculator-dev.xobarman.workers.dev` and uses isolated `tg-tips-calculator-dev` D1.
- Staff access is now managed through D1 table `staff_access` instead of relying on a single mutable GitHub Secret as the primary source of truth.
- `OWNER_TELEGRAM_USER_ID` remains a separate secret and owner access remains fail-closed.
- Owner-only UI `Доступ сотрудников` supports Telegram ID + employee name, add/update, and deactivate without deleting history.
- Telegram ID is the access key; username/display name are not used for authorization.
- Existing legacy allowlist remains as a temporary fallback for IDs that do not yet have a D1 row, allowing a safe staged migration.
- Once an ID has a D1 row, that row takes precedence and its active/inactive state controls access.
- Staff-access Beta was manually verified in Telegram by the owner on 2026-09-17: the owner card rendered correctly and adding/updating an employee through D1 worked.
- DEV deployment packaging was fixed to include `staff-access-ui.js`.
- Production deployment packaging was also fixed to include `staff-access-ui.js` before promotion.
- Production must reuse existing D1 `tg-tips-calculator-prod-20260916`; DEV data must never be imported.

## Current blocker
None. The owner explicitly approved production promotion of the verified D1 staff-access release on 2026-09-17.

## NEXT_ACTION
Fast-forward `main` to verified `dev`, let GitHub Actions apply `0004_staff_access.sql` to the existing production D1 and deploy the production Worker/static assets, verify CI and production health, then manually confirm `Доступ сотрудников` in the live Telegram Mini App before migrating remaining legacy staff IDs.
