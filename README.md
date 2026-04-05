# Meeting Tools

A meeting platform for **non-profit organizations**, focused on the full meeting lifecycle: creating meetings, inviting participants, running sessions, and following up on decisions and tasks.

It is a **full-stack meeting app** for structured meetings with live collaboration, including agenda flow, speaking queue, and polls/voting.

The **meeting experience is primarily designed for scenarios where participants are physically in the same room**. It can also be used alongside a video-conferencing tool, but it is not built around remote-first meeting dynamics.

## Main features

### Meetings

Meetings are the “run a session” surface: a structured in-meeting experience where participants join the same meeting and collaborate live.

- **How it works**: the primary UI uses **Convex realtime** (WebSocket) so participant state updates reactively.
- **Coupled polls**: a meeting can contain **in-meeting (coupled) polls** that are only accessible to participants in that meeting (as opposed to a standalone poll link).
- **Fallback mode**: there is a **simplified HTTP-only view** (polling) for networks or clients where WSS is blocked. This is intentionally participant-focused and avoids fast-changing moderator/admin surfaces.
- **Where it lives**:
  - **Primary**: `src/routes/(realtime)/m/...`
  - **Simplified HTTP fallback**: `src/routes/(no-realtime)/m/simplified/`

### Shareable polls

Polls are the “vote on a question” surface: a lightweight, shareable poll experience that can work broadly across the web.

- **How it works**: the poll page is designed to support **plain HTTPS** interactions via **SvelteKit server endpoints** that call Convex server-side (Convex stays source-of-truth).
- **Standalone entrypoint**: `/p/[code]` (see `src/routes/(no-realtime)/p/[code]/+page.svelte`).
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

```sh
bun install
```

### 2) Environment

Use `.env.local` for local development (gitignored). Variable names and semantics are defined in `[.env.schema](.env.schema)` ([Varlock](https://varlock.dev) / [@env-spec](https://varlock.dev/env-spec)); that file is for docs and Varlock tooling only—SvelteKit still loads values from `.env*` through Vite.

Check required variables against the schema: `bun run env:validate` (also runs inside `bun run build` and the Vercel `build:vercel` step before `vite build`).

Set the same environment variables in the [Convex dashboard](https://dashboard.convex.dev), so `src/convex/auth.ts` sees matching `process.env`.

### 3) Run the dev stack

```sh
# Vite + Convex together
bun run dev:all
```

Convex should be running during local development so generated types stay current. If you want to run Convex on your own machine instead of using a hosted dev deployment, Convex supports local deployments via `convex dev --local` (currently in beta). The deployment only exists while the dev command is running. See the [Convex local deployments docs](https://docs.convex.dev/cli/local-deployments).

If you would rather use a cloud dev deployment, setup is lightweight: sign in to Convex and start `bunx convex dev`, and Convex will guide you through linking the project.

Or run processes separately:

```sh
bun run dev:vite
bun run dev:convex
```

The app is usually served at `http://localhost:4000`.

## Repo quick tour

- **Routes (app UI)**: `src/routes/`
  - Primary meeting UI lives under `src/routes/(realtime)/...` (Convex client / realtime).
  - HTTP-only simplified UI lives under `src/routes/(no-realtime)/m/simplified/`.
- **Backend (Convex)**: `src/convex/`
- **UI primitives**: `src/lib/components/ui/`

## Documentation

- [Contributing](CONTRIBUTING.md)
- [License](LICENSE)
- [Roadmap](docs/roadmap.md)
- [Absence system](docs/absence.md)
- [Convex race condition analysis](docs/race-condition-analysis.md)
- [Simplified meeting view (HTTP polling fallback)](docs/features/simplified-meeting-http-fallback.md)
