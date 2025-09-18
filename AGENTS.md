# Repository Guidelines

## Project Structure & Module Organization
- `src/index.ts` boots the Express server, configures the grammY bot, and decides between webhook and long polling.
- `src/composer` groups command handlers (`*.handler.ts`) plus supporting helpers; add new bot flows here and register them in `createBotComposer`.
- `src/service` hosts external integrations such as the joke client; keep HTTP logic isolated here.
- `src/types` stores shared interfaces like `BotContext`; extend this before using new session data.
- TypeScript compiles into `dist/`; run-time config lives in `.env` (see Configuration & Secrets).

## Build, Test, and Development Commands
- `npm run dev` runs nodemon with `ts-node` for hot-reload while you iterate locally.
- `npm run build` emits JavaScript to `dist/` using the strict `tsconfig`.
- `npm run start` executes the compiled bot; use it to mirror production.
- `npm run lint` executes a no-emit type check; run before opening a PR.

## Coding Style & Naming Conventions
- Use TypeScript with 2-space indents, trailing commas, and single quotes as in existing files.
- Favor named exports and `registerXHandler` naming to mirror composer patterns.
- Organize shared helpers under `composer` or `service` rather than the entrypoint.
- Validate required environment variables at startup, following the guard in `src/index.ts`.

## Testing Guidelines
- A formal test runner is not yet configured; propose one in your PR and scope tests under `src/__tests__/`.
- At minimum, describe manual checks (e.g., `npm run dev` plus Telegram commands) in the PR.
- Mock external APIs such as the joke service so handlers stay deterministic.

## Commit & Pull Request Guidelines
- Follow the existing imperative, concise commit style (`Add joke service and commands`).
- Reference related issues in the body, include config changes, and attach webhook setup notes when relevant.
- PRs should summarize changes, list validation steps, and mention affected commands or env vars.

## Configuration & Secrets
- Populate `.env` with `TELEGRAM_BOT_TOKEN`, optional `PORT`, and `USE_WEBHOOK`; never commit secrets.
- Document any new configuration flags in the PR description and sample env files.
