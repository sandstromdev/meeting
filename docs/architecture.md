# Architecture notes

## SvelteKit route groups: `(realtime)` vs `(no-realtime)` vs root

SvelteKit [route groups](https://svelte.dev/docs/kit/advanced-routing#Advancedlayouts_grouplayouts) use parentheses so the segment **does not affect the URL**. Here they encode **how the route is allowed to depend on Convex**:

| Area             | Path (filesystem)                            | Intent                                                                                                                                                                                                                        |
| ---------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Realtime         | `src/routes/(realtime)/...`                  | UI may use **live Convex** (`useQuery`, `convexLoad` with client subscription, in-room meeting experience). Includes `(realtime)/m` (meeting participant/admin/moderator) and `(realtime)/(dash)` (meetings/polls dashboard). |
| No-realtime      | `src/routes/(no-realtime)/...`               | UI must **not** depend on browser realtime sync for correctness; **HTTP**, SvelteKit **remote** `query`/`command`, or **polling**. Includes simplified meeting fallback and public poll voting by code.                       |
| Root (ungrouped) | e.g. `src/routes/admin`, `(form)`, `profile` | **Auth**, **platform admin**, **small account pages**, **API**, **landing**—orthogonal to the realtime split, or not worth forcing into a group until behavior demands it.                                                    |

**Rule of thumb:** Put new trees under `(realtime)` or `(no-realtime)` when it helps readers and future layout guards (“this subtree must / must not assume live sync”). Keep thin or miscellaneous routes at the root; an empty root is not a goal.

**Note:** The root `+layout.svelte` still initializes the Convex browser client for the app; `(no-realtime)` means the **route implementation** should not require that live path, not that no client exists globally.

Prefer **`git mv`** when moving routes so Git records renames cleanly.

## Related docs

- Simplified meeting HTTP fallback: [features/simplified-meeting-http-fallback.md](features/simplified-meeting-http-fallback.md)
- Poll voting over HTTP: [features/poll-voting-over-http.md](features/poll-voting-over-http.md)
