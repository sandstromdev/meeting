# Simplified meeting view (HTTP polling fallback when WebSockets fail)

## Document Metadata

- **Status**: Draft
- **Created at**: 2026-03-26
- **Owner**: Meeting app (SvelteKit) + Convex backend
- **Motivation**: Some networks block or degrade WSS, preventing Convex realtime sync.

## Purpose

When the Convex browser client cannot establish or maintain a WebSocket (WSS) connection, the app should **automatically fall back** to a **simplified meeting experience** that works over **HTTP** with **polling**.

This fallback is intentionally scoped: it prioritizes participant-critical actions (agenda + speak/request buttons + polls + basic meeting presence) and avoids attempting to replicate the full realtime admin/moderator/projector experience.

## User story

- As a participant on a restrictive network (WSS blocked), I can still:
  - see the whole agenda (the “current item” is shown on a projector anyway),
  - join/leave the speaker list,
  - request reply, break, or point of order (and see whether those requests are pending/accepted to disable buttons),
  - leave the meeting (and return later),
  - vote in polls.
- As an admin/moderator, I should **not** rely on the fallback mode; the admin view requires realtime.

## Non-goals

- Support the full meeting UI (admin/moderator controls, projector, rich live state).
- Achieve “instant” updates without push transport.
- Implement a generic transport abstraction for every screen.

## Where this lives (routing)

- **Primary meeting experience**: existing meeting routes (WebSocket-based Convex client).
- **Fallback simplified experience**: `src/routes/(no-realtime)/m/simplified/`\*
  - This route group should be designed to work without the reactive Convex subscription model.

## Detecting WebSocket failure

### Signal source

Use Convex client connection metrics:

- `ConvexClient.connectionState()`
- `ConvexClient.subscribeToConnectionState(cb)`

Key fields:

- `isWebSocketConnected`: current socket ready state.
- `hasEverConnected`: whether we ever reached “ready” this session.
- `connectionRetries`: number of failed connection attempts.
- `connectionCount`: number of connections (reconnect churn signal).

### Suggested fallback decision rule

Declare the session “WSS unavailable” and route to simplified mode when any of the following holds:

- **Never connected**: `hasEverConnected === false` and `connectionRetries >= N`
- **Disconnected for too long**: `isWebSocketConnected === false` for `T` seconds (continuous)

Recommended defaults (tunable):

- **N**: 2–3 retries
- **T**: 5–10 seconds

### Hysteresis (avoid flapping)

Once in simplified mode, only auto-return to full mode if:

- `isWebSocketConnected === true` continuously for `H` seconds (e.g. 10s), OR
- user explicitly chooses “Try full mode again”.

## Simplified mode feature set

### 1) View whole agenda (no “current item” requirement)

- Display the complete agenda list.
- Do not depend on knowing the current agenda pointer.
- Prefer a compact, scroll-friendly rendering (participants will check quickly).

### 2) Speaker list: join / leave (without polling the whole queue)

Participant needs:

- Join speaker list (“add me”).
- Leave speaker list (“remove me” / “recall request”).
- See enough state to disable the buttons appropriately (e.g. “I’m already on the list”), without needing the full queue.

Backend interaction (existing intent):

- Mutations: `meeting/users/queue:request`, `meeting/users/queue:recallRequest`

### 3) Request reply / break / point of order (without polling fast live state)

Participant needs:

- Request **reply**, **break**, or **point of order**.
- See whether each request is currently:
  - not present
  - requested
  - accepted
    (to disable the relevant button and avoid duplicate submits)

Backend interaction:

- (Existing or new, depending on current API surface) participant mutations to request/recall these slots.

Note:

- The simplified UI does **not** need to poll current speaker or the full queue; it only needs these request-slot states to provide correct button disabling.

### 4) Leave / return to meeting

Participant needs:

- Leave meeting.
- Return later (same join flow as normal; simplified mode is just an alternate UI).

Backend interaction (existing intent):

- Mutations: `meeting/users/attendance:leaveMeeting`, `requestReturnToMeeting`, `recallReturnRequest`

### 5) HTTP-based voting in polls

Participant needs:

- See whether there is an active poll.
- Vote / retract vote (if supported in the normal UI).
- See results if results are visible (depending on meeting rules).

Backend interaction (existing intent):

- Queries: `meeting/users/meetingPoll:getCurrentPoll`, `getCurrentPollCounters`, `getPollResultsById`
- Mutations: `meeting/users/meetingPoll:vote`, `retractVote`

## Polling model (HTTP)

### Why a dedicated query

To avoid N separate HTTP calls every poll tick, simplified mode should use a **single “snapshot” query** that returns all state needed to render the simplified interface.

This query should be optimized for:

- stable response shape,
- minimal document reads,
- predictable bytes returned (avoid returning full histories/logs).

### Proposed Convex query (new)

Add a new query (name illustrative):

- `meeting/users/simplified:getColdSnapshot`
- `meeting/users/simplified:getHotSnapshot`
- `meeting/users/simplified:getMeSnapshot`

### Calling the query over HTTP (required)

The simplified UI must fetch data via **plain HTTPS** (not the Convex WebSocket client).

Because this app is primarily designed for **in-room meetings**, the simplified mode should avoid polling rapidly-changing live state that is already visible via **projector/admin/moderator surfaces** (see `AGENTS.md`). In practice, this means the simplified snapshots should **not** include the full speaker queue or current-speaker state.

However, simplified mode still needs to support participant actions (speaker-list join/leave and request reply/break/point-of-order). For these, it is sufficient (and cheap) to poll only the **request-slot states** (`null | requested | accepted`) and the current participant’s own “in speaker list” state for button disabling. This keeps polling payloads small while preserving correct UX.

All simplified-mode data reads and writes should be done via **remote functions** (server-side execution + type-safe client calls). There is no need to expose these as stable public `/api/v1/...` endpoints.

Remote functions should call the Convex query/queries using an HTTP client (e.g. `ConvexHttpClient` / `getConvexClient()`), then return typed data to the browser.

This ensures the simplified mode keeps working on networks where WSS is blocked but HTTPS requests still succeed.

Expected return payload (example shape; final types TBD), split into **cold** and **hot** meeting snapshots to prepare for a future “hot vs cold meeting data” refactor:

Cold meeting snapshot (e.g. `getSimplifiedMeetingColdSnapshot(...)`) should be meeting-only and cache-friendly:

- **agenda**: full agenda list (title, order, optional metadata)
- **fetchedAtMs**

Hot meeting snapshot (e.g. `getSimplifiedMeetingHotSnapshot(...)`) should be small and frequently-polled:

- **poll**
  - active poll (if any): id, title/question, options, type, constraints, isOpen
  - visibility flags for results
  - results/counters if visible (or a separate field to reduce payload when hidden)
- **requests**
  - `break`: null | `{ type: requested|accepted, by: { name, userId }, startTime? }` (or a simplified shape)
  - `reply`: same
  - `pointOfOrder`: same
- **fetchedAtMs**

Me snapshot should be minimal and user-specific (do not shared-cache):

- fields like:
  - “am I in speaker list?”
  - “can vote?”
  - “my vote”
  - anything derived from session/cookie/user identity
- **fetchedAtMs**

Notes:

- Keep payload **small**; omit admin-only fields.
- Prefer returning IDs + minimal display fields rather than whole documents where possible.
- Avoid returning a “current server time” from Convex in these snapshot payloads because it changes every request and effectively disables caching.

### Change detection (recommended)

To avoid re-fetching and re-serializing the full meeting snapshot when nothing relevant has changed, add cheap change signals for simplified mode:

- Store separate versions/hashes per meeting in a small runtime table (e.g. `meetingRuntimeStates`):
  - `simplifiedColdVersion` (agenda changes)
  - `simplifiedHotVersion` (poll + request-slot changes)
- Bump the relevant version in mutations that affect that slice:
  - cold: agenda edits
  - hot: poll open/close/show-results, vote/retract (if results are part of hot snapshot), request/accept/clear break/reply/point-of-order, etc.

Remote functions can then implement conditional fetching:

- client sends `knownColdVersion` / `knownHotVersion`
- server checks current versions
- if unchanged: return `{ changed: false, version, fetchedAtMs }`
- if changed: return `{ changed: true, version, fetchedAtMs, snapshot }`

### One-off Convex time sample (optional)

If you want a Convex-ish clock for display/statistics without breaking snapshot caching:

- Implement a remote function (e.g. `getConvexTimeOffset()`) on the SvelteKit server.
- Implement its source of truth as a Convex **httpAction** (via the Convex HTTP router, e.g. `src/convex/http.ts`) that returns `convexNowMs`.
- The remote function calls that `httpAction` server-side, then enriches the response with:
  - `fetchedAtMs` (time observed by the SvelteKit server)
  - `offsetMs = convexNowMs - fetchedAtMs`

The client can then approximate Convex time locally:

- `approxConvexNowMs = Date.now() + offsetMs`

Timers are non-critical in simplified mode, so this endpoint should be treated as best-effort and called infrequently (e.g. once on entry to simplified mode).

### Polling interval

Simplified mode runs a polling loop every **X seconds**.

Guidance:

- Default **X = 5s–10s**. Only tighten the interval when there is an active poll and the simplified UI is showing it.
- Consider backing off when the tab is hidden (`document.visibilityState`) or meeting is closed.

Configuration:

- Implement X as a constant or config value (and make it easy to tune).
- The UI should surface that the view is “compatibility mode” and may be delayed by up to X seconds.

### Write-path behavior (refetch-after-write)

After any participant mutation (speaker list join/leave, request reply/break/point-of-order, vote, leave meeting), the simplified UI should:

- immediately refetch the snapshot once (optimistic UI optional),
- then resume the normal polling cadence.

This keeps the experience responsive even with X set to a larger value.

## UX requirements

### Mode messaging

When falling back:

- Show a clear banner that the app is in a reduced compatibility mode because the network blocks realtime sync.
- Provide an action:
  - “Try full mode again”
  - “Continue in compatibility mode”

User-facing text should be Swedish (examples, final copy TBD):

- “Din nätverksmiljö verkar blockera realtidsanslutningen. Vi visar en förenklad vy som uppdateras var X sekund.”
- “Försök med full vy igen”

### Capabilities overview (set expectations)

In simplified mode, include a short “what works here” list:

- Agenda
- Talarlista (gå upp / gå ner)
- Begär replik / paus / ordningsfråga
- Omröstningar (rösta)
- Lämna mötet

And “what requires full mode”:

- Admin-/moderatorfunktioner

## Observability / debugging hooks

For debugging support (especially during rollout):

- Log connection state transitions (at least in dev).
- Capture a lightweight metric/event when the app enters simplified mode:
  - reason: never-connected vs disconnected-too-long
  - connectionRetries / connectionCount
  - meeting code/id (if safe) or a hash

## Security & correctness considerations

- Simplified mode uses the same auth and authorization as full mode.
- Do not introduce “public” meeting mutation paths to make polling easier; keep access rules intact.
- Ensure voting operations remain idempotent and safe under retries (polling users will click twice).

## Rollout plan

1. Add connection-state based fallback routing (feature flag optional).
2. Build simplified snapshots (`getColdSnapshot` / `getHotSnapshot` / `getMeSnapshot`) and simplified UI.
3. Tune X, N, T, H based on real-world tests (including WSS-blocked simulation via DevTools request blocking).
4. Add clear UX messaging and a manual “try again” action.
