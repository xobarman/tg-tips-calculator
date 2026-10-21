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

## 2026-10-21: Инга — доступ без участия в распределении чаевых
- В `Доступ сотрудников` можно выбрать имя `Инга` и выдать Telegram-доступ через существующую форму владельца.
- Имя `Инга` отсутствует в `EMPLOYEES` калькулятора, выборе официантов, выплатах и распределении сумм.
- Отдельные списки: `STAFF_ACCESS_NAMES` разрешает Ингу для авторизации, `EMPLOYEES` остаётся неизменным для начислений.
- Назначение существующих административных прав остаётся отдельным явным флажком (по умолчанию выключен).
- Для реальной выдачи доступа требуется Telegram ID Инги. Поскольку ID не предоставлен, никакой доступ в production не создавался.
- Изменения проверяются в DEV до отдельного разрешения на production.

## 2026-10-21: История / Период — выплаты и долг, без «Распределено»
- Скриншот: период 16–31.10 показывал отрицательные долги из-за вычитания выплат за более ранние начисления (дата перевода ≠ период заработка).
- Новый отдельный read-only `GET /api/period-balance?from=&to=` возвращает по пяти официантам `paidKopecks` (выплаты, датированные выбранным периодом) и `dueKopecks` (непогашенная часть чаевых, заработанных в выбранном периоде, на текущую московскую дату).
- Погашение долгов распределяется FIFO: сначала по более ранним заработанным чаевым, затем по выбранному периоду. Выплаты, сделанные в периоде за более ранние начисления, не превращают долг текущего периода в отрицательный.
- Верхняя граница расчёта автоматически ограничивается текущим московским днём, даже если выбран конец будущего периода. Долг не может быть отрицательным; избыточные выплаты не представляются как долг сотрудника.
- В карточке «Итог периода» только «Выплачено» и «Должны». Существующий фильтр сотрудника действует и для карточки/истории выплат.
- Главная карточка «Остаток месяца» использует старый `GET /api/summary` без изменений. Финансовые записи не меняются. Никаких миграций.
- Только DEV до отдельного явного разрешения на релиз.

## 2026-10-21: Критичный баг D1 — сохранение одиночной смены
- Screenshot: calculation for Анна, 1 waiter, gross 2933 ₽, net 2698.36 ₽; save fails with `CHECK constraint failed: participant_count IN (2, 3)`.
- Code supports 1 waiter, but original D1 table restriction still only allowed 2 or 3. Not a Telegram permission error and not a calculation error.
- Additive forward migration 0007 recreates `calculations` with participant_count IN (1,2,3), and recreates `payouts` as new child to avoid SQLite/D1 ON DELETE CASCADE wiping financial rows.
- Existing calculation history (including replaced audit rows), all payouts, payments, staff access and close markers must remain byte-equivalent. Indexes and foreign-key cascade recreated. No UI/business rule changes.
- Add populated-SQLite integrity regression test to CI. Verify D1 dev migration runs successfully before production release.

## 2026-10-21: Telegram group report after calculation save (DEV)
- User requested an automatic SINGLE message to the existing Telegram group whenever a shift calculation is saved, including each correction.
- Backend sends to Bot API `sendMessage` only AFTER successful D1 batch; never on preview/invalid save. Reports contain date, actor, gross total, morning/evening, common share, fee=8%, net share coefficients 1/N and 1/min(2,N), and final per-waiter distributions.
- Group notifications do not change calculations, payments, scheduled payouts or access controls.
- Opt-in Cloudflare Worker secret `TIPS_GROUP_CHAT_ID` per environment; absent => no message, no user-visible false success. Bot must be group member and permitted to send.
- Failed Telegram delivery returns `groupNotification.status=failed` in successful save response; UI reports it clearly WITHOUT suggesting re-saving, to avoid duplicate finance records.
- No group chat ID is known/provided yet; DEV can validate offline with injected send fetch. Need exact group ID and bot membership to run live group E2E. No production promotion before approval.
