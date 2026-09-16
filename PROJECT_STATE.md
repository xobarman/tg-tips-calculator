# PROJECT_STATE.md

## Current production
- Repository: `xobarman/tg-tips-calculator`.
- Live Telegram Mini App uses Cloudflare Worker production: `https://tg-tips-calculator.xobarman.workers.dev`.
- Telegram Menu Button and Main App point to the Cloudflare production URL.
- Production D1 is separate from DEV and was created clean for the release; its release preflight verified `calculations=0` and `payments=0` before first production use.
- Old DEV/test data remains isolated in the DEV D1 and must never be mixed into production totals.
- `main` still contains the older GitHub Pages implementation until the approved production promotion is performed.

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

## Audit history release candidate
- `dev` deploys to `https://tg-tips-calculator-dev.xobarman.workers.dev` and uses the isolated `tg-tips-calculator-dev` D1 database.
- A private Telegram Beta Direct Link points to the DEV Worker.
- The visible audit timeline has been manually verified in Telegram by the owner on 2026-09-16 and approved for production promotion.
- Shared history shows every saved version for a business date: original calculation, later corrections, author display name, Moscow time, changed totals, and resulting employee distribution.
- Telegram IDs are not exposed in the shared audit timeline.
- Only the active version affects normal history, monthly counters, and outstanding balances.
- Payment history continues to show who recorded each payout.
- Production deployment must reuse the existing production D1 `tg-tips-calculator-prod-20260916`; it must not create or import DEV data.

## Current blocker
None. The owner explicitly approved promotion of the verified audit-history beta to production.

## NEXT_ACTION
Fast-forward `main` to the verified `dev` release candidate, let GitHub Actions deploy the existing production D1/Worker, verify CI and production health, then manually confirm the audit timeline in the live Telegram Mini App.
