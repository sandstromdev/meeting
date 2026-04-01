# Contributing

Thanks for your interest in contributing.

This project is a meeting platform for non-profit organizations, with a primary focus on in-room meetings. Contributions are welcome, especially when they improve reliability, usability, accessibility, or maintainability without losing that product focus.

## Before you start

If you want to work on a larger feature, open an issue or start a discussion first. Small bug fixes and focused improvements can usually go straight to a pull request.

Please prefer small, reviewable changes over large mixed refactors.

## Getting set up

This project uses Bun for package management and script execution.

```sh
bun install
bun run dev:all
```

The app usually runs at `http://localhost:4000`.

Environment variables are documented in `.env.schema`. Use `.env.local` for local development. For backend values used by Convex, keep the Convex dashboard environment in sync where needed.

## Testing

Please run the relevant checks before opening a pull request:

- `bun run check`
- `bun run lint`
- `bun run test`

If your change affects behavior, add or update tests when that meaningfully reduces regression risk.

## Submitting changes

Please open a GitHub pull request with a clear description of what changed and why.

When you open a pull request, include:

- the problem being solved
- the approach you took
- notes on testing
- screenshots or recordings for UI changes when helpful

Atomic commits are appreciated. If your change is intentionally incomplete or has known follow-up work, call that out clearly in the pull request description.

## Project conventions

We optimize for readability and predictable behavior.

- User-facing text should be in Swedish.
- Prefer existing shared primitives from `src/lib/components/ui`.
- Respect the `src/routes/(realtime)` and `src/routes/(no-realtime)` split when adding or moving routes.

For more project context and architecture details, see `README.md` and `docs/architecture.md`.

## Licensing and contribution terms

This project is licensed under `AGPL-3.0-only`.

By submitting a contribution, you agree that your contribution may be distributed as part of this project under that license.
