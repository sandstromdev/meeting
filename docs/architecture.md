# Architecture notes

## SvelteKit route groups: `(realtime)` vs `(no-realtime)` vs `(auth)` vs root

SvelteKit [route groups](https://svelte.dev/docs/kit/advanced-routing#Advancedlayouts_grouplayouts) use parentheses so the segment **does not affect the URL**. Here they encode **how the route is allowed to depend on Convex** (and, for `(auth)`, that the surface is auth rather than meeting UI):

| Area        | Path (filesystem)              | Intent                                                                                                                                                                                                                                                                                         |
| ----------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Realtime    | `src/routes/(realtime)/...`    | UI may use **live Convex** (`useQuery`, `convexLoad` with client subscription, in-room meeting experience). Includes `(realtime)/m` (meeting participant/admin/moderator) and `(realtime)/(dash)` (meetings/polls dashboard).                                                                  |
| No-realtime | `src/routes/(no-realtime)/...` | UI must **not** depend on browser realtime sync for correctness; **HTTP**, SvelteKit **remote** `query`/`command`, or **polling**. Includes **`(no-realtime)/m/anslut`** (join by code), **`(no-realtime)/m/simplified`** (polling fallback), and **`(no-realtime)/p/[code]`** (poll by code). |
| Auth        | `src/routes/(auth)/...`        | Sign-in and sign-up. Orthogonal to the meeting/realtime split; correctness via Better Auth and server loads, not live meeting subscriptions.                                                                                                                                                   |
| Root        | e.g. `admin`, `profile`, `api` | **Platform admin**, **profile**, **API**, **marketing home**—orthogonal to the realtime split, or not worth a dedicated group.                                                                                                                                                                 |

**Rule of thumb:** Put new trees under `(realtime)` or `(no-realtime)` when it helps readers and future layout guards (“this subtree must / must not assume live sync”). Use `(auth)` for credential flows. Keep thin or miscellaneous routes at the root; an empty root is not a goal.

**Note:** The root `+layout.svelte` still initializes the Convex browser client for the app; `(no-realtime)` means the **route implementation** should not require that live path, not that no client exists globally.

Prefer **`git mv`** when moving routes so Git records renames cleanly.

## `(no-realtime)/m` parent layout

Routes under `(no-realtime)/m` share `+layout.svelte` (e.g. shared dialogs) and `+layout.server.ts`. The server load **must not** require an existing meeting session on **`/m/anslut`**: participants land there to **set** the meeting cookie. That route is therefore **special-cased** in the layout load so it returns without running the “already in a meeting” meeting payload path. Sibling routes such as **`/m/simplified`** use the normal branch: load meeting data, enforce access, and apply participant/admin redirect rules.

If you add another **`(no-realtime)/m/...`** page that should behave like anslut (no meeting yet), extend the same guard in `+layout.server.ts` so it does not run meeting loaders prematurely.

## Shared form presentation

[`form-page-layout.svelte`](../src/lib/components/ui/form-page-layout.svelte) is the centered, top-offset column shell used by auth and join pages. It keeps spacing consistent when those pages live in different route groups without relying on a parent route layout for styling.

## Related docs

- Simplified meeting HTTP fallback: [features/simplified-meeting-http-fallback.md](features/simplified-meeting-http-fallback.md)
- Poll voting over HTTP: [features/poll-voting-over-http.md](features/poll-voting-over-http.md)
