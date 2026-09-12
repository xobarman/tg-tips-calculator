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
- A real 2-person Telegram scenario has passed end-to-end: calculate -> save -> D1 persistence -> history read -> per-employee summary. The saved record and both 6,992.00 RUB employee totals were read back correctly for the test calculation.
- Employee selection supports: Александр, Александра, Анна, Арсик, Снежа; waiter 3 can be empty for a 2-person shift.
- Money is stored as integer kopecks.
- Latest relevant GitHub Actions tests and Cloudflare dev deployment are passing.

## Current blocker
There is no infrastructure blocker. Before considering production cutover, the remaining functional gate is to verify one real 3-person calculation/save/history scenario inside Telegram because its common-pool split differs from the already-verified 2-person path.

## NEXT_ACTION
Verify one 3-person Telegram scenario end-to-end in the dev Mini App: calculate -> save -> history, and confirm the three payouts match the expected formula.
