# AGENTS.md

## Project
Telegram Mini App for calculating and recording staff tip distributions.

## Stable rules
- `main` is the currently used production version. Do not change or merge into `main` without explicit user approval.
- Develop new functionality on `dev` (or short-lived branches from `dev`) and verify it before production cutover.
- Do not commit Telegram bot tokens, Cloudflare tokens, D1 credentials, or other secrets.
- Money is stored and calculated as integer kopecks.
- Commission is fixed at 8% unless the user explicitly changes the business rule.
- Waiters 1 and 2 receive both the common share and the `morning + evening` share.
- Waiter 3 is optional. If absent, the common share is split between waiters 1 and 2.
- Allowed employee names: Александр, Александра, Анна, Арсик, Снежа.
- The same employee cannot occupy two waiter positions in one calculation.
- Server-side code must recalculate payouts; never trust payout totals submitted by the client.
- Telegram `initData` must be validated server-side before reading or writing financial history.
- History access should be restricted to explicitly allowed Telegram user IDs.
- Prefer minimal changes and a small vertical slice over additional infrastructure.
