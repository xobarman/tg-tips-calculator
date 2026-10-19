# PROJECT_STATE.md

## Current production
- Repository: `xobarman/tg-tips-calculator`.
- Live Telegram Mini App uses Cloudflare Worker production: `https://tg-tips-calculator.xobarman.workers.dev`.
- Telegram Menu Button and Main App point to the Cloudflare production URL.
- Production D1 is separate from DEV and must remain isolated from DEV/test data.
- Last verified GitHub production deployment: 2026-09-17, `main` at `1dbea1f`. Owner reports the production calculator has operated successfully for about 1.5 months (2026-10-19).

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

## Feature development 2026-10-19 (NOT production)
- Branch: `feature/admin-accrual-periods-20261019`, based on `dev`.
- Owner-managed admin permission: `staff_access.can_correct` (migration `0005_staff_can_correct.sql`). Admins may correct existing calculations for any date but cannot record payments or manage staff.
- Derived tip balances: current Moscow half-month (1–15 or 16–last) and separately previously accrued unpaid money. Amounts switch at 00:00 on 16th and 1st; no cron, history deletion, or destructive zeroing.
- Actual payments settle older accrued balances first. Changes to old calculations automatically reflow into the accrued amount; negative due after retroactive corrections stays visible.
- CAUTION: The current historical data may contain payments actually made outside the app and not entered in the payment ledger. The initial accrued amount must be reconciled before production release.
- Feature-branch tests pass; no feature deployment to production has been performed.

## Current blocker
Telegram end-to-end testing in isolated DEV and opening balance reconciliation have not yet been completed.

## NEXT_ACTION
Merge feature into `dev` only, inspect isolated DEV deployment/migration, test administrator corrections, boundary rollovers and payments inside Telegram, and confirm opening balances before asking for explicit production approval.
