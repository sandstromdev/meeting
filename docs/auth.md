# Auth (Better Auth + Convex)

This project uses **Better Auth**, but **the entire auth backend lives on the Convex backend**, both **Better Auth Data** (sessions, accounts, etc.) and HTTP handlers. This is the **simplest possible auth setup** when using **Convex with SvelteKit**, without involving external auth providers such as **WorkOS**, **Auth0** or **Clerk**.

## High-level architecture

There are two relevant HTTP surfaces:

- **Public site**: `PUBLIC_BETTER_AUTH_URL` (or `PUBLIC_SITE_URL`)
- **Convex**: `PUBLIC_CONVEX_SITE_URL`

All Better Auth endpoints are exposed under:

- `(...PUBLIC_BETTER_AUTH_URL or PUBLIC_SITE_URL)/api/auth/[...]`

But SvelteKit does **not** implement auth logic there. Instead, it **forwards** those requests to:

- `PUBLIC_CONVEX_SITE_URL/api/auth/[...]`

…and Convex handles everything from that point onward.

## Request flow

1. Browser/client calls `GET/POST /api/auth/...` on the **public site** domain.
2. SvelteKit receives the request at `src/routes/api/auth/[...all]/+server.ts`.
3. SvelteKit **redirects/proxies** the request to `PUBLIC_CONVEX_SITE_URL/api/auth/...`.
4. Convex executes Better Auth’s HTTP handler(s) and reads/writes Better Auth data.
5. The response is returned back to the client.

## What to change when extending auth

### Preferred: Better Auth plugins

To extend auth behavior, the supported path is to use **Better Auth plugin options**.

For organizations, Better Auth supports **SSO** and other enterprise login methods through plugins.

### Decoupling auth from Convex

If you want to “decouple” auth, you effectively need to:

- Roll your own auth system completely, and
- Update the Convex implementation to trust and use that auth system, and
- Build/adjust the corresponding Convex functions (e.g. actions/queries) needed by the app to fetch users, map identities, etc.

This is **quite difficult** and **not something I encourage or support** in this codebase.

## Future direction

In the future, we may add **environment flags** to:

- Enable/disable **email + password** login
- Customize login behavior/UX **without changing the code** of the login/signup pages
