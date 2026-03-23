# Meeting

A meeting platform for SMBs, focused on the full meeting lifecycle: create meetings, invite participants, run sessions, and follow up on decisions and tasks.

**UI language:** All user-facing copy in the app is **Swedish**. Developer documentation (including this file) is in **English**. Everything is UTF-8.

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

## Project status

Current focus is the core meeting loop (lifecycle, access control, invites/RSVP). See the [roadmap](docs/ROADMAP.md) for priorities and next steps.
