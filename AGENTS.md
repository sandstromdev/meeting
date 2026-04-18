# AGENTS

If Convex codegen fails or generated Convex types look temporarily broken, ignore it for now; it is often resolved by reloading TypeScript types or running `bun run dev` (Turbo: web + Convex) manually.

Environment variables are documented in the canonical [`packages/common/.env.schema`](packages/common/.env.schema); each app adds [`apps/web/.env.schema`](apps/web/.env.schema) and [`apps/convex/.env.schema`](apps/convex/.env.schema) that import it. Varlock is for docs and per-app `bun run env:validate` / `varlock load`—Convex does not run Varlock; use the Convex dashboard for backend `process.env`.

This project uses [Bun](https://bun.sh) as its package manager and script runner (workspaces + Turborepo). Install dependencies with `bun install` at the repo root. Run `package.json` scripts with `bun run <script>` (for example `bun run dev` for Vite and Convex together via Turbo, or `bun run check` for typechecking). Package-local scripts also work under `apps/web` and `apps/convex`. For one-off package binaries, use `bunx` instead of `npx` when you want Bun to execute them (for example `bunx convex ai-files install` from `apps/convex`).
Note: run tests via `bun run test` (not `bun test`) so we consistently use the `package.json` script (and any project-specific setup it includes).

Prefer the existing shared UI primitives in [`apps/web/src/lib/components/ui`](apps/web/src/lib/components/ui) whenever possible instead of introducing new raw HTML patterns or duplicate components.

All of the user facing text in this project is in **swedish**. Agentic communication and development, as well as all docs should be mainly written in english. Everything should be UTF-8 encoded.

Product context (important for agents and users): the meeting experience in this app is primarily intended for **in-room meetings** where participants are physically in the same room. It can also be used alongside a video-conferencing tool, but it is not designed as a remote-first meeting platform.

Implication for the simplified (HTTP polling) mode: avoid polling or returning **rapidly-changing live state** that is expected to be visible in the room via **projector/admin/moderator surfaces**. For example, including the **speaker queue** in a simplified snapshot is typically redundant and can be expensive to poll frequently (it may touch a fast-changing set of documents). In the normal realtime Convex participant UI this is less of a concern due to reactive subscriptions, but in polling mode prefer stable, participant-critical state.

## SvelteKit routing (`apps/web/src/routes`)

Route group folders `(realtime)` and `(no-realtime)` do **not** appear in URLs; they document **Convex / transport expectations**.

- **`(realtime)`** — Surfaces that assume or will assume **live Convex** in the browser (`useQuery`, `convexLoad` + client sync, meeting realtime UI). Examples: `(realtime)/m`, `(realtime)/(dash)`.
- **`(no-realtime)`** — Surfaces that **must not rely** on realtime Convex for correctness: HTTP / remote polling patterns, simplified meeting fallback, standalone poll-by-code. Examples: `(no-realtime)/m/simplified`, `(no-realtime)/p`.

**Leave at `apps/web/src/routes` root** when a route is orthogonal (auth, profile, platform `/admin`, marketing home, API) or grouping would only be cosmetic. See [docs/architecture.md](docs/architecture.md) for a slightly longer rationale.

When **moving or renaming** files under `apps/web/src/routes`, prefer **`git mv`** (not plain `mv` then `git add`) so Git records **renames** and `git log --follow` / blame stay usable. Quote paths that contain parentheses, e.g. `git mv apps/web/src/routes/p "apps/web/src/routes/(no-realtime)/p"`. If you rewrite a moved file so heavily that Git no longer detects a rename, that is normal; the move itself should still start with `git mv`.
