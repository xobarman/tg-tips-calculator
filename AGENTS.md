# AGENTS.md

## Project
Telegram Mini App for calculating and recording staff tip distributions.

## Stable rules
- `main` is the currently used production version. Do not change or merge into `main` without explicit user approval.
- Develop new functionality on `dev` (or short-lived branches from `dev`) and verify it before production cutover.
- Do not commit Telegram bot tokens, Cloudflare tokens, D1 credentials, Telegram user IDs used for access control, or other secrets.
- Money is stored and calculated as integer kopecks.
- Commission is fixed at 8% unless the user explicitly changes the business rule.
- One, two, or three waiters may participate. Waiter 1 is required; waiter 2 and 3 are optional, but waiter 3 cannot be selected without waiter 2.
- With one waiter, the sole waiter receives the entire common and `morning + evening` net amounts (8% fee applied as before).
- With two or three waiters, waiters 1 and 2 receive both the common share and the `morning + evening` share. Waiter 3 receives only the common share.
- The common share is divided among all selected waiters; the shift share is divided among up to the first two waiters.
- Tip-eligible waiters only: Александр, Александра, Анна, Арсик, Снежа. Do not add non-waiter staff to this money-recipient list.
- Staff access identities additionally allow Инга, but Инга MUST NOT appear in waiter selectors, tip calculation participants, financial summaries or payout recipient selectors. Staff access is granted via owner's Telegram ID form; default correction permission stays false.
- The same employee cannot occupy two waiter positions in one calculation.
- Server-side code must recalculate payouts; never trust payout totals submitted by the client.
- Telegram `initData` must be validated server-side before reading or writing financial history.
- History and save access must be restricted to explicitly allowed Telegram user IDs.
- There is at most one active saved calculation per business date. Any allowed staff member may create the first save for the current Moscow business day; later saves for that day are blocked for other staff.
- The Telegram user who first saved/locked the current Moscow business day may replace that day's active calculation until 00:00 Europe/Moscow. That submitter identity must survive later corrections.
- The configured owner Telegram ID may create a missing calculation for a past business date or replace an existing active calculation for any past or current business date at any time. Owner corrections do not remove the original day submitter's same-day correction right before 00:00.
- Replaced calculation rows remain only as an audit trail and must not affect normal history, monthly counters, or outstanding balances.
- Actual employee payouts are a separate ledger from tip calculations. Only the configured owner Telegram ID may record payouts.
- Displayed outstanding balances are distributed tips minus recorded payouts for the selected period/month.
- Historical corrections to existing calculations belong to owner-appointed administrators: an active D1 staff row with `can_correct = 1`. Administrators cannot backfill missing days, manage staff access or record payments.
- Keep the original single "Остаток месяца" dashboard card. Monthly `distributed - paid` shows current outstanding tip debt; history never resets destructively.
- Automatically record scheduled `payments` ONLY after a Moscow period ends: first close 2026-10-31 (write on Nov 1), then each 15th and last day of a month. The first close must include the existing full October unpaid balance; do NOT retroactively close October 15.
- Automatic payment IDs are deterministic and each close is guarded by a D1 `automatic_period_closures` marker. A daily Worker cron at 21:05 UTC (00:05 Moscow) handles closing even when no app is open; finance reads also reconcile missed runs.
- These records are **scheduled bank payouts as reported by the owner, not verified bank transfers**. The application has no bank API integration, so never represent it as an externally confirmed transaction. Real recorded manual payments remain in the ledger and are subtracted before automatic close.
- All per-day calculations, manual payouts, corrections and audit history stay intact; no deletion or destructive resetting.
- Prefer minimal changes and a small vertical slice over additional infrastructure.
