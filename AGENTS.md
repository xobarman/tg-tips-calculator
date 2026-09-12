# AGENTS.md

## Project
Telegram Mini App for calculating and recording staff tip distributions.

## Stable rules
- `main` is the currently used production version. Do not change or merge into `main` without explicit user approval.
- Develop new functionality on `dev` (or short-lived branches from `dev`) and verify it before production cutover.
- Do not commit Telegram bot tokens, Cloudflare tokens, D1 credentials, Telegram user IDs used for access control, or other secrets.
- Money is stored and calculated as integer kopecks.
- Commission is fixed at 8% unless the user explicitly changes the business rule.
- Waiters 1 and 2 receive both the common share and the `morning + evening` share.
- Waiter 3 is optional. If absent, the common share is split between waiters 1 and 2.
- Allowed employee names: Александр, Александра, Анна, Арсик, Снежа.
- The same employee cannot occupy two waiter positions in one calculation.
- Server-side code must recalculate payouts; never trust payout totals submitted by the client.
- Telegram `initData` must be validated server-side before reading or writing financial history.
- History and save access must be restricted to explicitly allowed Telegram user IDs.
- There is at most one active saved calculation per business date. Any allowed staff member may create the first save for the current Moscow business day; later saves for that day are blocked for other staff.
- The Telegram user who first saved/locked the current Moscow business day may replace that day's active calculation until 00:00 Europe/Moscow. That submitter identity must survive later corrections.
- The configured owner Telegram ID may replace an existing active calculation for any past or current business date at any time. Owner corrections do not remove the original day submitter's same-day correction right before 00:00.
- Replaced calculation rows remain only as an audit trail and must not affect normal history, monthly counters, or outstanding balances.
- Actual employee payouts are a separate ledger from tip calculations. Only the configured owner Telegram ID may record payouts.
- Displayed outstanding balances are distributed tips minus recorded payouts for the selected period/month.
- Monthly counters are derived by calendar-month date range, never by deleting history. A new month starts at zero while prior months remain queryable.
- Prefer minimal changes and a small vertical slice over additional infrastructure.
