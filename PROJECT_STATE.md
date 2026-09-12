# PROJECT_STATE.md

## Current production
- Repository: `xobarman/tg-tips-calculator`.
- `main` is the live GitHub Pages Mini App already used by the Telegram bot.
- Production calculator has three numeric inputs and the original 3-person calculation.
- Production must remain unchanged while the new version is being built.

## Development
- `dev` branch is the isolated development branch.
- Target architecture: Cloudflare Pages preview for the UI + Cloudflare Worker API + D1.
- Worker/D1 scaffold includes Telegram initData validation, allowlisted access, calculations history, and per-employee summaries.
- Employee selection will support: Александр, Александра, Анна, Арсик, Снежа; waiter 3 can be empty for a 2-person shift.
- Money is stored as integer kopecks.

## Current blocker
Cloudflare resources are not created yet: Pages project, Worker, D1 database, bindings, and secrets.

## NEXT_ACTION
Connect the GitHub repository to a Cloudflare Pages project with `main` as production and `dev` as preview, without changing the current Telegram bot URL.
