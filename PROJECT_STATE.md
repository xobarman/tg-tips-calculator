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
- GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` have been added by the user.
- `.github/workflows/deploy-dev.yml` now bootstraps the dev D1 database if needed, applies migrations, deploys the Worker/static assets, and configures the Telegram bot token as a Cloudflare Worker secret.
- The first deploy workflow run completed safely with deployment steps skipped because `TELEGRAM_BOT_TOKEN` is not yet present in GitHub Secrets.

## Current blocker
The dev Worker cannot validate Telegram Mini App sessions until the bot token is available to CI as the GitHub Actions secret `TELEGRAM_BOT_TOKEN`.

## NEXT_ACTION
Add the existing Telegram bot token to GitHub Actions Secrets as `TELEGRAM_BOT_TOKEN` without exposing it in chat. Then trigger the dev workflow with a state-only commit and review the Cloudflare deployment result.
