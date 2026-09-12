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
- D1 database `tg-tips-calculator-dev` exists and migration `0001_init.sql` is applied.
- Telegram bot token is configured in Cloudflare as a Worker secret via GitHub Actions; it is not committed to the repository.
- GitHub Actions secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `TELEGRAM_BOT_TOKEN` are configured by the user.
- Deployment workflow uploads only `index.html`, `app.js`, and `styles.css` as static assets. Repository internals are not part of the active static asset manifest.
- The dev frontend automatically uses the same-origin Worker API when served from `workers.dev`.
- Worker/D1 scaffold includes Telegram initData validation, fail-closed allowlisted access, calculation history, and per-employee summaries.
- Employee selection supports: Александр, Александра, Анна, Арсик, Снежа; waiter 3 can be empty for a 2-person shift.
- Money is stored as integer kopecks.
- Latest Cloudflare dev deployment and GitHub Actions deployment job are passing.

## Current blocker
`ALLOWED_TELEGRAM_USER_IDS` is intentionally empty, so history reads/writes remain fail-closed. We first need to open the dev URL as a real Telegram Mini App, read the authenticated Telegram user ID through `/api/whoami`, and then configure the allowlist.

## NEXT_ACTION
Create a separate Direct Link Mini App under the existing bot that points to `https://tg-tips-calculator-dev.xobarman.workers.dev`, while leaving the existing Main App URL unchanged. Open that dev Mini App in Telegram and use the displayed Telegram ID to configure the first allowlisted tester.
