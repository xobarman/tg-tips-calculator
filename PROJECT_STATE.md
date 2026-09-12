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
- GitHub Actions secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `TELEGRAM_BOT_TOKEN` are configured by the user.
- Deployment workflow uploads only `index.html`, `app.js`, and `styles.css` as static assets. Repository internals are not part of the active static asset manifest.
- The dev frontend automatically uses the same-origin Worker API when served from `workers.dev`.
- Worker/D1 scaffold includes Telegram initData validation, fail-closed allowlisted access, calculation history, and per-employee summaries.
- The dev Mini App successfully authenticated the first tester through `/api/whoami` and displayed the tester's Telegram ID inside Telegram.
- The deployment workflow now reads `ALLOWED_TELEGRAM_USER_IDS` from GitHub Actions Secrets so tester IDs do not need to be committed to this public repository.
- Employee selection supports: Александр, Александра, Анна, Арсик, Снежа; waiter 3 can be empty for a 2-person shift.
- Money is stored as integer kopecks.
- Latest Cloudflare dev deployment and GitHub Actions deployment job are passing.

## Current blocker
The authenticated tester ID is known, but `ALLOWED_TELEGRAM_USER_IDS` has not yet been added to GitHub Actions Secrets. History reads/writes therefore remain fail-closed.

## NEXT_ACTION
Add the displayed tester Telegram ID to GitHub Actions Secrets as `ALLOWED_TELEGRAM_USER_IDS` without committing the ID to the public repository. Then trigger the dev deployment and verify save/history end-to-end inside Telegram.
