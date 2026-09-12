# PROJECT_STATE.md

## Current production
- Repository: `xobarman/tg-tips-calculator`.
- `main` is the live GitHub Pages Mini App already used by the Telegram bot.
- Production calculator has three numeric inputs and the original 3-person calculation.
- Production must remain unchanged while the new version is being built.

## Development
- `dev` branch is the isolated development branch.
- Target architecture: Cloudflare Worker + D1, with the development deployment kept separate from the current GitHub Pages production URL.
- Worker/D1 scaffold includes Telegram initData validation, allowlisted access, calculations history, and per-employee summaries.
- Employee selection supports: Александр, Александра, Анна, Арсик, Снежа; waiter 3 can be empty for a 2-person shift.
- Money is stored as integer kopecks.
- GitHub Actions tests on `dev` are passing.

## Current blocker
Cloudflare Git integration is looping back to the GitHub App configuration page instead of completing repository connection. The GitHub App itself is installed and limited to `xobarman/tg-tips-calculator`.

## Decision
Do not keep retrying the broken Cloudflare Git-connect UI. Use GitHub Actions + Wrangler to deploy the isolated `dev` Worker directly to Cloudflare. The current `main`/GitHub Pages production remains untouched.

## NEXT_ACTION
Create a restricted Cloudflare API token for Workers/D1 deployment and add it to GitHub Actions secrets without exposing the token in chat.
