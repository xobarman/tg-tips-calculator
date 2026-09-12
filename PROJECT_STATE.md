# PROJECT_STATE.md

## Current production
- Repository: `xobarman/tg-tips-calculator`.
- `main` is the live GitHub Pages Mini App already used by the Telegram bot.
- Production calculator has three numeric inputs and the original 3-person calculation.
- Production must remain unchanged while the new version is being built.

## Development
- `dev` branch is the isolated development branch.
- Cloudflare dev architecture is live: one Worker serves the test Mini App static assets plus `/api/*`, backed by D1. The current GitHub Pages production URL remains untouched.
- Dev Worker URL: `https://tg-tips-calculator-dev.xobarman.workers.dev`.
- A separate Telegram Direct Link Mini App for dev has been created under the existing bot and points to the Cloudflare dev Worker. The existing Main App and Menu Button remain unchanged.
- D1 database `tg-tips-calculator-dev` exists and migration `0001_init.sql` is applied.
- Telegram bot token is configured in Cloudflare as a Worker secret via GitHub Actions; it is not committed to the repository.
- GitHub Actions secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `TELEGRAM_BOT_TOKEN`, and `ALLOWED_TELEGRAM_USER_IDS` are configured by the user.
- Deployment workflow uploads only `index.html`, `app.js`, and `styles.css` as static assets. Repository internals are not part of the active static asset manifest.
- The dev frontend automatically uses the same-origin Worker API when served from `workers.dev`.
- Worker/D1 scaffold includes Telegram initData validation, fail-closed allowlisted access, calculation history, and per-employee summaries.
- The dev Mini App successfully authenticated the first tester through `/api/whoami` inside Telegram.
- The first tester allowlist is deployed and history access is enabled for that tester.
- A real 2-person Telegram scenario passed end-to-end: calculate -> save -> D1 persistence -> history read -> per-employee summary.
- A real 3-person Telegram scenario also passed end-to-end. Control input `1500 / 300 / 300` produced `552 / 552 / 276` RUB, saved successfully, and the same three payouts were read back from history. The cumulative per-employee summary updated accordingly.
- Employee selection supports: Александр, Александра, Анна, Арсик, Снежа; waiter 3 can be empty for a 2-person shift.
- Money is stored as integer kopecks.
- The dev UI has received a bounded visual polish pass: clearer hierarchy, cleaner cards/buttons/fields, more compact DEV notice, and improved result/history presentation.
- A monthly tips counter is now shown from saved D1 records for the current calendar month. It is derived from the current month date range rather than destructively reset: on the first day of a new month it naturally starts at zero while prior-month records remain intact in D1/history.
- History now includes a quick `Прошлый месяц` period shortcut, so the prior month's archived totals can be reopened without changing stored data.
- Latest worker tests and Cloudflare dev deployment for these changes are passing.

## Current blocker
There is no infrastructure blocker. The new UI/monthly-counter change is deployed to dev but has not yet been manually checked inside Telegram after deployment. Production cutover is still not authorized and `main` remains unchanged.

## NEXT_ACTION
Open the Telegram dev Mini App and manually verify the polished UI, the current-month counter total/breakdown, and the `Прошлый месяц` history shortcut. If that passes, resume the bounded production-readiness review before any production cutover decision.
