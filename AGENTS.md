# AGENTS

If Convex codegen fails or generated Convex types look temporarily broken, ignore it for now; it is often resolved by reloading TypeScript types or running `bun run dev` (Turbo: SvelteKit apps + Convex) manually.

Environment variables are documented in the canonical [`packages/common/.env.schema`](packages/common/.env.schema). [`apps/meetings/.env.schema`](apps/meetings/.env.schema), [`apps/polls/.env.schema`](apps/polls/.env.schema), and [`apps/convex/.env.remote.schema`](apps/convex/.env.remote.schema) import it; [`apps/convex/.env.schema`](apps/convex/.env.schema) is the slim local Convex / CLI schema. Varlock is for docs and per-app checks: `bun run env:load` runs `varlock load` with a visible summary; `bun run env:validate` runs the same validation quietly via [`scripts/varlock-load-quiet.ts`](scripts/varlock-load-quiet.ts) (non-zero exit on failure; avoids shell-only `>/dev/null` for Windows). Dashboard env vs the common spec is checked by [`apps/convex/scripts/validate-convex-env.ts`](apps/convex/scripts/validate-convex-env.ts) (`env:convex` / `env:convex:prod`). Convex does not run Varlock at runtime; use the Convex dashboard for backend `process.env`.

This project uses [Bun](https://bun.sh) as its package manager and script runner (workspaces + Turborepo). Install dependencies with `bun install` at the repo root. Run `package.json` scripts with `bun run <script>` (for example `bun run dev` for Vite and Convex together via Turbo, or `bun run check` for typechecking). Package-local scripts also work under `apps/meetings`, `apps/polls`, and `apps/convex`. For one-off package binaries, use `bunx` instead of `npx` when you want Bun to execute them (for example `bunx convex ai-files install` from `apps/convex`).
Note: run tests via `bun run test` (not `bun test`) so we consistently use the `package.json` script (and any project-specific setup it includes).

Prefer the existing shared UI primitives in [`apps/meetings/src/lib/components/ui`](apps/meetings/src/lib/components/ui) whenever possible instead of introducing new raw HTML patterns or duplicate components.

All of the user facing text in this project is in **swedish**. Agentic communication and development, as well as all docs should be mainly written in english. Everything should be UTF-8 encoded.

Product context (important for agents and users): the meeting experience in this app is primarily intended for **in-room meetings** where participants are physically in the same room. It can also be used alongside a video-conferencing tool, but it is not designed as a remote-first meeting platform.

Implication for the simplified (HTTP polling) mode: avoid polling or returning **rapidly-changing live state** that is expected to be visible in the room via **projector/admin/moderator surfaces**. For example, including the **speaker queue** in a simplified snapshot is typically redundant and can be expensive to poll frequently (it may touch a fast-changing set of documents). In the normal realtime Convex participant UI this is less of a concern due to reactive subscriptions, but in polling mode prefer stable, participant-critical state.

## SvelteKit routing (`apps/meetings/src/routes`)

Route group folders `(realtime)` and `(no-realtime)` do **not** appear in URLs; they document **Convex / transport expectations**.

- **`(realtime)`** — Surfaces that assume or will assume **live Convex** in the browser (`useQuery`, `convexLoad` + client sync, meeting realtime UI). Examples: `(realtime)/m`, `(realtime)/(dash)`.
- **`(no-realtime)`** — Surfaces that **must not rely** on realtime Convex for correctness: HTTP / remote polling patterns, simplified meeting fallback, standalone poll-by-code. Examples: `(no-realtime)/m/simplified`, `(no-realtime)/p`.

**Leave at `apps/meetings/src/routes` root** when a route is orthogonal (auth, profile, platform `/admin`, marketing home, API) or grouping would only be cosmetic. See [docs/architecture.md](docs/architecture.md) for a slightly longer rationale.

When **moving or renaming** files under `apps/meetings/src/routes`, prefer **`git mv`** (not plain `mv` then `git add`) so Git records **renames** and `git log --follow` / blame stay usable. Quote paths that contain parentheses, e.g. `git mv apps/meetings/src/routes/p "apps/meetings/src/routes/(no-realtime)/p"`. If you rewrite a moved file so heavily that Git no longer detects a rename, that is normal; the move itself should still start with `git mv`.
