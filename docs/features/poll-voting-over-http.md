# Standalone poll voting over HTTP (`/p/[code]`)

## Document Metadata

- **Status**: Draft
- **Created at**: 2026-03-26
- **Owner**: SvelteKit app + Convex backend (standalone polls)
- **Motivation**: Voting in standalone user polls should work via **plain HTTP** so it can be used broadly across the web, not tied to Convex client calls from the Svelte app.

## Purpose

Enable participants to **cast and retract votes via plain HTTP** using SvelteKit **remote functions** (server-side `query`/`command` handlers), instead of calling Convex mutations directly from the browser in `src/routes/(no-realtime)/p/[code]/+page.svelte`.

This is specifically intended to support:

- a **standalone poll link** experience (`/p/[code]`) that “just works” over HTTPS,
- consuming voting from other web surfaces/clients without embedding Convex client logic in them.

The Convex backend remains the source of truth; HTTP endpoints should be thin wrappers that enforce auth/authorization, validate inputs, and call existing Convex mutations/queries server-side.

## User story

- As a participant, I can open a poll voting link on any device/network and:
  - see the active poll (if any),
  - vote for an option,
  - see a confirmation that my vote was recorded,
  - optionally retract/change my vote (if rules allow),
  - see results when results are visible.

## Non-goals

- Redesign the standalone poll UI/UX.
- Provide a full “poll management” UI over HTTP (create/edit/open/close polls) beyond what `/p/[code]` already supports.
- Build a generic public API for the entire app surface.
- Support unauthenticated voting (unless explicitly decided later with dedicated threat modeling).

## Why HTTP (not Convex browser calls)

- **Cross-web usage**: `/p/[code]` is a standalone feature, not a meeting UI surface.
- **Interoperability**: a stable HTTP surface can be consumed by other web clients without coupling to Convex browser client semantics.
- **Security/control**: centralized server-side validation, rate limiting, and consistent error behavior.

## Where this lives (routing)

This feature should be implemented as **remote functions colocated with the route**, e.g.:

- `src/routes/(no-realtime)/p/[code]/data.remote.ts` (suggested)

Remote functions should:

- run server-side via `$app/server` (`query` / `command`),
- validate input using `zod`,
- call Convex via `getConvexClient()` (i.e. `ConvexHttpClient`),
- return typed data (no bespoke REST routing required),
- be callable only from **same-origin** pages by default.

## Remote function surface (proposed)

### Read

- `getPollByCode` (remote `query`)
  - Input: `{ code: string, voterSessionToken: string }`
  - Returns: poll summary + whether the requester has voted + visibility flags.

Optionally also:

- `getPollById` (remote `query`)
  - Input: `{ pollId: string, voterSessionToken: string }`

### Write

- `vote` (remote `command`)
  - Input: `{ pollId: string, optionIndexes: number[], voterSessionToken: string, idempotencyKey?: string }`
  - Semantics: **upsert** (set my vote to `optionIndexes`)

- `retractVote` (remote `command`)
  - Input: `{ pollId: string, voterSessionToken: string, idempotencyKey?: string }`

Notes:

- Remote functions still run over HTTPS, but the calling convention is the project’s remote-function mechanism rather than ad-hoc `/api/...` JSON routes.

## Authentication & authorization

### Baseline requirement

Voting must be restricted to users who are allowed to vote in that poll according to existing rules (including `visibilityMode` constraints).

The HTTP endpoints should reuse the app’s existing auth/session mechanisms (cookies) and the existing standalone-poll identity mechanism (`voterSessionToken`), and perform authorization server-side before calling Convex mutations.

### Cross-site / embed considerations

Not planned for now:

- Other origins should **not** be able to call the voting surface.
- Do not add CORS support or bearer-token schemes unless/when the product requirements change.

## Security considerations

### Input validation

- Validate `code` (when used), `pollId`, and option selections.
- Reject unknown options and closed polls with clear error codes.

### Idempotency & retries

Clients in degraded environments will retry.

- Support `Idempotency-Key` header (or `idempotencyKey` field) on write endpoints.
- On the server, ensure repeated submissions don’t create inconsistent state.
- Convex mutation should be safe to call repeatedly (set vote to option, not “increment counter”).

### Abuse controls

- Rate limit by poll + identity (and optionally IP as a secondary signal).
- Return consistent errors for unauthorized vs forbidden without leaking poll existence.

### CORS

Non-goal for now. Keep the surface **same-origin only**.

## Backend integration (Convex)

### Source-of-truth functions

Prefer reusing the existing standalone poll functions used by `src/routes/(no-realtime)/p/[code]/+page.svelte`:

- Query: `api.userPoll.public.getByCode` (or equivalent)
- Query: `api.userPoll.public.getVoteCounts` (or equivalent)
- Mutation: `api.userPoll.public.vote`
- Mutation: `api.userPoll.public.retractVote`

Remote functions should call these server-side using Convex HTTP client access with the requester identity attached (do not use elevated privileges unless intentionally designed).

### Response shape stability

Return small, stable payloads:

- poll metadata (question, options, isOpen),
- my vote (nullable),
- results only when visible and only in an aggregated form.

Avoid returning highly dynamic or admin-only fields.

## Client integration patterns

### In-app (same-origin)

- Replace direct Convex mutation calls in the poll voting UI with calls to remote functions (e.g. `vote(...)`, `retractVote(...)`).
- After successful vote/retract, refresh poll state once (then resume any existing polling cadence if used).

### External web usage

The “external” use case is still same-origin: users land on `/p/[code]` and the page uses remote functions for reads/writes.

All user-facing strings must be Swedish in the actual UI; this doc stays English.

## Error model (suggested)

Use a consistent JSON error envelope:

- `{ ok: false, code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'POLL_CLOSED' | 'INVALID_OPTION' | 'NOT_FOUND', message }`

Do not leak sensitive details in `message`. Prefer a stable `code` for UI branching.

## Rollout plan

1. Implement remote functions (`getPollByCode`, `vote`, `retractVote`) colocated with `src/routes/(no-realtime)/p/[code]/`.
2. Switch `src/routes/(no-realtime)/p/[code]/+page.svelte` to call the remote functions instead of Convex browser mutations.
3. Keep behavior identical (including `visibilityMode` gating, validation rules, and Swedish UI strings).
4. Add observability: event when remote voting is used (success/failure codes, latency buckets).
