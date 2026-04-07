# Meeting Tools

A meeting platform primarily for **non-profit organizations**, focused on the full meeting lifecycle: create meetings, invite participants, run sessions, and follow up on decisions and tasks.

**UI language (at this time):** All user-facing copy in the app is **Swedish**. Developer documentation (including this file) is in **English**.

## Warning

This project is under active development and may change at any time. Please use at your own risk.

## Purpose (why this exists)

This platform contains a **collection of useful tools for meetings** (and related things). It’s a **full-stack meeting app** intended to make it easy to run a structured meeting with live collaboration (agenda, speaking queue, polls/voting) while building toward the full product loop (provisioning → invites/RSVP → run → follow-up).

The **meeting experience is primarily designed for scenarios where participants are physically in the same room**. It can also be used alongside a video-conferencing tool, but it is not built around remote-first meeting dynamics.

## Main functionality

### Meetings

Meetings are the “run a session” surface: a structured in-meeting experience where participants join the same meeting and collaborate live.

- **How it works**: the primary UI uses **Convex realtime** (WebSocket) so participant state updates reactively.
- **Coupled polls**: a meeting can contain **in-meeting (coupled) polls** that are only accessible to participants in that meeting (as opposed to a standalone poll link).
- **Fallback mode**: there is a **simplified HTTP-only view** (polling) for networks or clients where WSS is blocked. This is intentionally participant-focused and avoids fast-changing moderator/admin surfaces.
- **Where it lives**:
  - **Primary**: `src/routes/(form)/...`
  - **Simplified HTTP fallback**: `src/routes/(no-convex)/m/simplified/`

### Polls

Polls are the “vote on a question” surface: a lightweight, shareable poll experience that can work broadly across the web.

- **How it works**: the poll page is designed to support **plain HTTPS** interactions via **SvelteKit server endpoints** that call Convex server-side (Convex stays source-of-truth).
- **Standalone entrypoint**: `/p/[code]` (see `src/routes/p/[code]/+page.svelte`).
- **Why it’s different from meetings**: it’s intentionally decoupled from the realtime meeting UI so voting can work in restricted environments and be consumed by other web surfaces without embedding Convex client logic.

### How they differ (at a glance)

- **Scope**: **Meetings** are a multi-feature session; **polls** are a focused voting flow.
- **Client transport**: meetings primarily rely on **realtime subscriptions**; polls can be served via **plain HTTP endpoints**.
- **Networking goals**: meetings optimize for live collaboration; polls optimize for “open link and vote anywhere”.

## Product snapshot (as of this repo)

- **UI language**: All user-facing copy in the app is **Swedish**. Developer documentation (including this file) is in **English**.
- **License**: This project is licensed under **AGPL-3.0-only**. See [`LICENSE`](LICENSE).

## Getting started

### 1) Install dependencies

```sh
bun install
```

### 2) Environment

Use `.env.local` for local development (gitignored). Variable names and semantics are defined in `[.env.schema](.env.schema)` ([Varlock](https://varlock.dev) / [@env-spec](https://varlock.dev/env-spec)); that file is for docs and Varlock tooling only—SvelteKit still loads values from `.env*` through Vite.

Check required variables against the schema: `bun run env:validate`.

Set the same environment variables in the [Convex dashboard](https://dashboard.convex.dev), so `src/convex/auth.ts` sees matching `process.env`.

### 3) Run the dev stack

```sh
# Vite + Convex together
bun run dev:all
```

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

## Common scripts

```sh
bun run check        # Svelte / TS check
bun run lint         # Prettier + oxlint
bun run fix          # Format + auto-fix

bun run test         # Vitest (once)
bun run test:watch   # Vitest (watch)

bun run build
bun run preview
```

## Documentation

- [Contributing](CONTRIBUTING.md)
- [License](LICENSE)
- [Roadmap](docs/roadmap.md)
- [Absence system](docs/absence.md)
- [Convex race condition analysis](docs/race-condition-analysis.md)
- [Simplified meeting view (HTTP polling fallback)](docs/features/simplified-meeting-http-fallback.md)

## Project status

Current focus is the core meeting loop (lifecycle, access control, invites/RSVP). See the [roadmap](docs/roadmap.md) for priorities and next steps.
