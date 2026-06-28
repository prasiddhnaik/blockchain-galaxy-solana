# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the app code. `src/App.tsx` and `src/main.tsx` are the entry points.
- `src/scene/` holds 3D scene components such as `Galaxy.tsx`, `Block.tsx`, and `Particles.tsx`.
- `src/data/` stores Solana data helpers and the committed snapshot in `chain-snapshot.json`.
- `public/` contains static assets served by Vite.
- `scripts/update-chain-snapshot.mjs` refreshes the cached chain data.

## Project Context
- Blockchain Galaxy is a Solana visualizer built with Vite, React, TypeScript, React Three Fiber, three.js, and GSAP.
- The home view is a Solana ecosystem scene: Solana is the central sun, and curated named programs orbit as planets.
- Search is the travel path. Autocomplete is intentionally limited to curated popular programs, while pasted raw program IDs should still work.
- Destination systems use the selected program as the sun and recent matching blocks as planets. The current destination window is 40 recent blocks.
- Start continuation work by inspecting `src/scene/Galaxy.tsx` and `src/data/solana.ts`.

## Build, Test, and Development Commands
- Package scripts use `scripts/with-node.sh` so they can find the bundled Codex Node runtime when `node` is not on `PATH`.
- `pnpm install` installs dependencies.
- `pnpm setup` is the project alias for dependency installation.
- `pnpm dev` starts the local Vite dev server.
- `pnpm up` installs dependencies and starts the local dev server on `127.0.0.1`.
- `pnpm build` runs TypeScript build checks and produces the production bundle.
- `pnpm check` runs `pnpm lint` and `pnpm build`.
- `pnpm preview` serves the built output locally.
- `pnpm demo` builds the app and starts a local production preview.
- `pnpm lint` runs ESLint across the repository.
- `pnpm refresh:snapshot` updates `src/data/chain-snapshot.json` from Solana data.
- `pnpm refresh:check` refreshes the snapshot, then runs lint and build.
- `pnpm dev:network` starts Vite on `0.0.0.0` for testing from another device on the same network.

## Coding Style & Naming Conventions
- Use TypeScript and React function components.
- Follow the existing ESLint setup in `eslint.config.js`; lint before submitting changes.
- Prefer `camelCase` for variables, functions, and hooks; use `PascalCase` for React components and scene classes.
- Keep file names descriptive and aligned with their exported feature, for example `ChainPath.tsx` or `update-chain-snapshot.mjs`.

## Testing Guidelines
- There is no dedicated test runner configured yet.
- Treat `pnpm build` and `pnpm lint` as the minimum verification gate before review.
- If you add tests, place them near the code they cover and use the naming pattern already familiar to the project, such as `*.test.ts` or `*.test.tsx`.

## Commit & Pull Request Guidelines
- Git history uses short, imperative commit messages, such as `Increase Solana program activity block count`.
- Keep commits focused and avoid mixing snapshot refreshes with unrelated refactors.
- Pull requests should describe the change, note any data refreshes or environment needs, and include screenshots or screen recordings for scene changes.

## Configuration Notes
- Do not commit secrets. Use a local `.env` file for `HELIUS_API_KEY` and `VITE_HELIUS_API_KEY`.
- If you refresh the snapshot, verify the resulting JSON changes before committing.
- `VITE_HELIUS_API_KEY` is exposed in the client bundle by design for this client-only build, so keep quotas low and never commit the real value.
- Live program search should keep the safe fallback behavior: timeout, retry, then cached snapshot data with a visible `LIVE` or `CACHED` badge.

## Repository Terms
- `public repo` means this curated public-safe app repository.
- `private repo` means the separate private source-of-record repository for this project.
- If a request mentions either term, interpret it as referring to this project unless the user says otherwise.

## Public Artifact Rules
- Do not commit private handoff reports, local verification JSON, screenshots, `.env`, or other internal artifacts to the public repo.
- Before pushing publicly, verify private-only files are absent and `.env` remains ignored.
- Keep public changes limited to shareable app code, public docs, and intentional assets.

## Agent-Specific Tools
- Use [@ponytail](plugin://ponytail@ponytail) when the user asks for Ponytail-assisted review, audit, debt, or project analysis workflows.

## Known Caveats
- The `System` program currently dominates the rollup and is categorized as `token`; decide deliberately before recategorizing or removing it.
- Live search totals can differ from cached snapshot totals because live search uses a moving recent-slot window.
- Browser screenshot capture previously caused one large frame spike during warp FPS testing; retest without capture before making final performance claims.
