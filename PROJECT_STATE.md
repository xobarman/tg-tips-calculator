# PROJECT_STATE.md

## Current production
- Repository: `xobarman/tg-tips-calculator`.
- Live Telegram Mini App uses Cloudflare Worker production: `https://tg-tips-calculator.xobarman.workers.dev`.
- Telegram Menu Button and Main App point to the Cloudflare production URL.
- Production D1 is separate from DEV and must remain isolated from DEV/test data.
- Production deployed and passed CI/health on 2026-10-19 (`2ed4511`). Owner reports the production calculator has operated successfully for about 1.5 months (2026-10-19).

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

## October 19 correction / current work
- Owner rejected the second "Начислено" card. Restore exactly one original monthly outstanding card with employee names, distributed amounts and paid amounts.
- October 2026 currently remains open throughout Oct 31, including its pre-existing balance. The first automatic bank-scheduled ledger payout is recorded only after Moscow midnight on Nov 1, with `business_date = 2026-10-31`.
- Future closes: Nov 15 -> Nov 16, Nov 30 -> Dec 1, and continuing on every 15th / month end.
- New no-data-loss `0006_auto_period_closures.sql`; existing production D1 is never replaced. Payments are inserted only for still-unpaid amounts and uniquely keyed per employee and close date.
- Daily Worker scheduled trigger (21:05 UTC -> 00:05 MSK), plus idempotent reconciliation on authenticated financial API reads.
- Automatic payment rows indicate bank-payment schedule only. No bank transaction verification is connected.
- Do not release to production before DEV tests and explicit user approval.

## Fix 2026-10-19: owner missed-day backfill and summary overflow
- Owner screenshot showed an unsaved calculation for historical date 2026-10-18. Existing API prevented *creating* historical entries even for owner. Allow owner-only creation of missing past days, while preserving one active saved entry per date, audit, Telegram identity and current-day staff restrictions.
- The payment ledger editing UI is a separate feature and remains unchanged; no payment amounts have been modified.
- Mobile summary negative balances now keep amount and RUB unit on a single line using a two-column minmax/max-content grid.
- Work on feature branch; verify DEV before production promotion.

## Current blocker
Validate the corrected one-card display and automatic payout closing logic in DEV; do not modify or delete any historical production ledger rows.

## NEXT_ACTION
Test idempotent auto-payment settlement in DEV and verify original monthly UI; then request production approval.

## One-waiter calculation (2026-10-19)
- New owner request: a shift may have only waiter 1 selected, with waiter 2 and 3 empty.
- All net common and net `morning + evening` tips go to that one waiter; 8% fee, historical 2/3 person rules, integer kopeck rounding and server-side recalculation are unchanged.
- UI allows `Нет второго` and disables the third selector until waiter 2 is selected.
- Validate unit tests and DEV live page before production release; no schema changes, no modifications to existing financial data.
