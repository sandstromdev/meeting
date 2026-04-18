# Meeting Tools

A meeting platform for **non-profit organizations**, focused on the full meeting lifecycle: creating meetings, inviting participants, running sessions, and following up on decisions and tasks.

It is a **full-stack meeting app** for structured meetings with live collaboration, including agenda flow, speaking queue, and polls/voting.

The **meeting experience is primarily designed for scenarios where participants are physically in the same room**. It can also be used alongside a video-conferencing tool, but it is not built around remote-first meeting dynamics.

## Repository layout

This repo is a **Bun** monorepo with **Turborepo**:

| Path                                 | Package           | Role                                                                                                                 |
| ------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| [`apps/web`](apps/web)               | `@lsnd-mt/web`    | SvelteKit frontend (Vite, routes, UI)                                                                                |
| [`apps/convex`](apps/convex)         | `@lsnd-mt/convex` | Convex backend (functions, schema, auth)                                                                             |
| [`packages/common`](packages/common) | `@lsnd-mt/common` | Shared TypeScript (poll/validation helpers, etc.) and the **canonical** [`.env.schema`](packages/common/.env.schema) |

Root [`package.json`](package.json) orchestrates workspaces; most day-to-day scripts run via **`bun run …`** at the repo root (Turbo) or inside a specific app when you prefer.

## Main features

### Meetings

Meetings are the “run a session” surface: a structured in-meeting experience where participants join the same meeting and collaborate live.

- **How it works**: the primary UI uses **Convex realtime** (WebSocket) so participant state updates reactively.
- **Coupled polls**: a meeting can contain **in-meeting (coupled) polls** that are only accessible to participants in that meeting (as opposed to a standalone poll link).
- **Fallback mode**: there is a **simplified HTTP-only view** (polling) for networks or clients where WSS is blocked. This is intentionally participant-focused and avoids fast-changing moderator/admin surfaces.
- **Where it lives**:
  - **Primary**: `apps/web/src/routes/(realtime)/m/...`
  - **Simplified HTTP fallback**: `apps/web/src/routes/(no-realtime)/m/simplified/`

### Shareable polls

Polls are the “vote on a question” surface: a lightweight, shareable poll experience that can work broadly across the web.

- **How it works**: the poll page is designed to support **plain HTTPS** interactions via **SvelteKit server endpoints** that call Convex server-side (Convex stays source-of-truth).
- **Standalone entrypoint**: `/p/[code]` (see `apps/web/src/routes/(no-realtime)/p/[code]/+page.svelte`).
- **Why it’s different from meetings**: it’s intentionally decoupled from the realtime meeting UI so voting can work in restricted environments and be consumed by other web surfaces without embedding Convex client logic.

### How they differ (at a glance)

- **Scope**: **Meetings** are a multi-feature session; **polls** are a focused voting flow.
- **Client transport**: meetings primarily rely on **realtime subscriptions**; polls can be served via **plain HTTP endpoints**.
- **Networking goals**: meetings optimize for live collaboration; polls optimize for “open link and vote anywhere”.

### Non-goals (at least for now)

- This is not a generic video-conferencing tool.
- The “simplified” HTTP fallback is intentionally **participant-focused** and does not attempt to replicate realtime admin/moderator features.

## Notes

- **UI language**: All user-facing copy in the app is **Swedish**. Developer documentation (including this file) is in **English**.
- **License**: This project is licensed under **AGPL-3.0-only**. See [`LICENSE`](LICENSE).

## Getting started

### 1) Install dependencies

From the **repository root**:

```sh
bun install
```

This installs all workspace packages (`apps/*`, `packages/*`) into a single lockfile.

### 2) Environment

- **Local secrets**: use **`apps/web/.env.local`** and **`apps/convex/.env.local`** (gitignored). Keep them in sync for shared keys, or duplicate a single root `.env.local` into both when setting up a new machine.
- **Schema**:
  - Canonical definitions: [`packages/common/.env.schema`](packages/common/.env.schema) ([Varlock](https://varlock.dev) / [@env-spec](https://varlock.dev/env-spec)).
  - Each app composes that file via import: [`apps/web/.env.schema`](apps/web/.env.schema), [`apps/convex/.env.schema`](apps/convex/.env.schema).

Those schema files are for documentation and Varlock—they are not loaded by SvelteKit or Convex at runtime. SvelteKit still reads `.env*` via Vite from **`apps/web`**; Convex uses dashboard env and `process.env`.

Validate from the root (all packages that define `env:validate`):

```sh
bun run env:validate
```

Or per app:

```sh
cd apps/web && bun run env:validate
cd apps/convex && bun run env:validate
```

Set the same variables in the [Convex dashboard](https://dashboard.convex.dev) so code under [`apps/convex/src`](apps/convex/src) (e.g. auth) sees matching `process.env`.

### 3) Run the dev stack

From the **repository root**, run Vite and Convex in parallel via Turbo:

```sh
bun run dev
```

Or run them in separate terminals:

```sh
cd apps/web && bun run dev
```

```sh
cd apps/convex && bun run dev
```

Convex should be running during local development so generated types stay current. If you want to run Convex on your own machine instead of using a hosted dev deployment, Convex supports local deployments via `convex dev --local` (currently in beta). The deployment only exists while the dev command is running. See the [Convex local deployments docs](https://docs.convex.dev/cli/local-deployments).

If you would rather use a cloud dev deployment, setup is lightweight: sign in to Convex and start `bunx convex dev` from **`apps/convex`**, and Convex will guide you through linking the project.

The app is usually served at `http://localhost:4000` (see `apps/web` dev script).

### 4) Build, check, test (root)

```sh
bun run build    # Turbo: production build (web)
bun run check    # Turbo: svelte-check (web)
bun run test     # Turbo: Vitest (web + convex)
bun run lint     # Turbo: Prettier + oxlint where configured
```

## Deployment (Vercel)

The SvelteKit app is configured for Vercel with **Root Directory** `apps/web`. See [`apps/web/vercel.json`](apps/web/vercel.json): install runs from the **monorepo root** (`cd ../.. && bun install --frozen-lockfile`) so workspace dependencies resolve. Production deploys that bundle Convex use `apps/web`’s `build:vercel` script (Convex deploy + web build).

## Repo quick tour

- **Routes (app UI)**: `apps/web/src/routes/`
  - Primary meeting UI: `apps/web/src/routes/(realtime)/...`
  - HTTP-only simplified UI: `apps/web/src/routes/(no-realtime)/m/simplified/`
- **Backend (Convex)**: `apps/convex/src/`
- **Shared TS + env spec**: `packages/common/src/`, `packages/common/.env.schema`
- **UI primitives**: `apps/web/src/lib/components/ui/`

## Documentation

- [Contributing](CONTRIBUTING.md)
- [License](LICENSE)
- [Roadmap](docs/roadmap.md)
- [Convex race condition analysis](docs/race-condition-analysis.md)
- [Simplified meeting view (HTTP polling fallback)](docs/features/simplified-meeting-http-fallback.md)
- [Architecture](docs/architecture.md)
- [Auth](docs/auth.md)
