# Meeting

A meeting platform primarily for **non-profit organizations**, focused on the full meeting lifecycle: create meetings, invite participants, run sessions, and follow up on decisions and tasks.

**UI language (at this time):** All user-facing copy in the app is **Swedish**. Developer documentation (including this file) is in **English**.

## Purpose (why this exists)

This repo is a **full-stack meeting app** intended to make it easy to run a structured meeting with live collaboration (agenda, speaking queue, polls/voting) while building toward the full product loop (provisioning → invites/RSVP → run → follow-up).

The **meeting experience is primarily designed for scenarios where participants are physically in the same room**. It can also be used alongside a video-conferencing tool, but it is not built around remote-first meeting dynamics.

**Non-goals (at least for now)**

- This is not a generic video-conferencing tool.
- The “simplified” HTTP fallback is intentionally **participant-focused** and does not attempt to replicate realtime admin/moderator features.

## Product snapshot (as of this repo)

- **Meetings exist and can be updated in-meeting**, but **in-app meeting provisioning (create/list)** is not yet implemented. Details and planned work live in `docs/ROADMAP.md`.
- **Primary experience** uses Convex’s realtime client (WebSocket).
- **Fallback simplified experience** exists under `src/routes/(no-convex)/...` for networks where WSS is blocked (see docs link below).

## Stack

- **SvelteKit** + **Svelte 5**
- **Convex** (backend)
- **Better Auth**
- **Tailwind CSS**
- **Bun** (package manager and script runner)

## Prerequisites

- [Bun](https://bun.sh) installed

## Getting started

### 1) Install dependencies

```sh
bun install
```

### 2) Environment

Use `.env.local` for local development (gitignored). Variable names and semantics are defined in [`.env.schema`](.env.schema) ([Varlock](https://varlock.dev) / [@env-spec](https://varlock.dev/env-spec)); that file is for docs and Varlock tooling only—SvelteKit still loads values from `.env*` through Vite.

Check required variables against the schema: `bun run env:validate` (also runs inside `bun run build` and the Vercel `build:vercel` step before `vite build`).

Set the same `PUBLIC_*` values in the [Convex dashboard](https://dashboard.convex.dev) for your deployment so `src/convex/auth.ts` sees matching `process.env`.

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
  - Primary meeting UI lives under `src/routes/(form)/...` (Convex client / realtime).
  - HTTP-only simplified UI lives under `src/routes/(no-convex)/m/simplified/`.
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

- [Roadmap](docs/ROADMAP.md)
- [Absence system](docs/ABSENCE.md)
- [Convex race condition analysis](docs/RACE_CONDITION_ANALYSIS.md)
- [Simplified meeting view (HTTP polling fallback)](docs/features/simplified-meeting-http-fallback.md)

## Project status

Current focus is the core meeting loop (lifecycle, access control, invites/RSVP). See the [roadmap](docs/ROADMAP.md) for priorities and next steps.
