# PROJECT_STATE.md

## Current production
- Repository: `xobarman/tg-tips-calculator`.
- Live Telegram Mini App now uses Cloudflare Worker production: `https://tg-tips-calculator.xobarman.workers.dev`.
- Telegram Menu Button and Main App have been manually switched to the Cloudflare production URL.
- Production D1 is separate from DEV and was created clean for the release; its release preflight verified `calculations=0` and `payments=0` before first production use.
- Old DEV/test data remains isolated in the DEV D1 and must never be mixed into production totals.
- The previously confusing DEV Direct Link is no longer the production entry point.
- `main` still contains the older GitHub Pages implementation and is not the runtime source for the live Telegram app. Do not rewrite it casually; production cutover/promotion should be deliberate.

## Production functionality
- Branding: `Encore Café City · Чаевые`, developer mark `by Novikov Development`.
- Employee selection: Александр, Александра, Анна, Арсик, Снежа; waiter 3 may be empty for a 2-person shift.
- Money is stored and calculated as integer kopecks; server-side code recalculates distributions.
- Commission is 8%.
- Telegram `initData` is validated server-side.
- Save/history access is restricted by explicit Telegram user-ID allowlist.
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

## Beta / development
- `dev` deploys to `https://tg-tips-calculator-dev.xobarman.workers.dev` and uses the isolated `tg-tips-calculator-dev` D1 database.
- Beta work is prepared on `beta/audit-history-v1` and then fast-forwarded to `dev` for Telegram testing.
- New beta feature: a visible history audit timeline for all allowed staff.
- The audit API returns every saved version of a calculation, including inactive replaced versions, but never exposes Telegram IDs in the shared history.
- The beta history UI groups versions by business date and shows who created the original calculation, who made each correction, Moscow time, changed totals, and the resulting employee distribution.
- Existing payment history continues to show who recorded each payout.
- Production Worker and production D1 are not modified by this beta.

## Current blocker
The audit-history beta has not yet been manually checked inside Telegram against the DEV Worker.

## NEXT_ACTION
Deploy `beta/audit-history-v1` to `dev`, open it through a dedicated private Telegram beta Direct Link, and manually verify one original calculation plus at least one correction in the visible audit timeline before any production promotion.
