# PROJECT_STATE.md

## Current production
- Repository: `xobarman/tg-tips-calculator`.
- `main` is the live GitHub Pages Mini App already used by the Telegram bot.
- Production calculator has three numeric inputs and the original 3-person calculation.
- Production must remain unchanged while the new version is being built.

## Development
- `dev` branch is the isolated development branch.
- Target architecture: one Cloudflare Worker serving the dev Mini App static assets plus `/api/*`, backed by D1. The current GitHub Pages production URL remains untouched.
- Worker/D1 scaffold includes Telegram initData validation, allowlisted access, calculations history, and per-employee summaries.
- Employee selection supports: Александр, Александра, Анна, Арсик, Снежа; waiter 3 can be empty for a 2-person shift.
- Money is stored as integer kopecks.
- GitHub Actions tests on `dev` are passing.
- Cloudflare Git-connect UI was abandoned because it loops back to GitHub App configuration.
- GitHub Actions secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `TELEGRAM_BOT_TOKEN` have been added by the user.
- `.github/workflows/deploy-dev.yml` bootstraps the dev D1 database if needed, applies migrations, deploys the Worker/static assets, and configures the Telegram bot token as a Cloudflare Worker secret.

## Current blocker
The first real Cloudflare dev deployment is being triggered now. Until it succeeds, the dev URL, D1 database, and API availability are not yet confirmed.

## NEXT_ACTION
Review the triggered `Deploy dev to Cloudflare` GitHub Actions run. If it succeeds, confirm the Worker URL and `/api/health`, then configure the Telegram allowlist before testing history writes.
