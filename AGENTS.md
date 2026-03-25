<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `src/convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

When you **create** or **notice** new registered Convex functions (new `query`, `mutation`, `action`, or internal variants, including builder-style `.public()` / `.internal()` exports), **update** [`docs/CONVEX_FUNCTIONS_MAP.md`](docs/CONVEX_FUNCTIONS_MAP.md) so the map stays complete. Adjust the similarity section if the change introduces or resolves overlapping APIs.

<!-- convex-ai-end -->

If Convex codegen fails or generated Convex types look temporarily broken, ignore it for now; it is often resolved by reloading TypeScript types or running `bun run dev:all` manually.

Environment variables are documented in [`.env.schema`](.env.schema) (do not invent new names without updating the schema). Varlock is for docs and `bun run env:validate` / `varlock load`—Convex does not run Varlock; use the Convex dashboard for backend `process.env`.

This project uses [Bun](https://bun.sh) as its package manager and script runner. Install dependencies with `bun install`. Run `package.json` scripts with `bun run <script>` (for example `bun run dev:all` for Vite and Convex together, or `bun run check` for typechecking). For one-off package binaries, use `bunx` instead of `npx` when you want Bun to execute them (for example `bunx convex ai-files install`).

Prefer the existing shared UI primitives in [`src/lib/components/ui`](src/lib/components/ui) whenever possible instead of introducing new raw HTML patterns or duplicate components.

All of the user facing text in this project is in **swedish**. Agentic communication and development, as well as all docs should be mainly written in english. Everything should be UTF-8 encoded.
