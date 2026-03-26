If Convex codegen fails or generated Convex types look temporarily broken, ignore it for now; it is often resolved by reloading TypeScript types or running `bun run dev:all` manually.

Environment variables are documented in [`.env.schema`](.env.schema) (do not invent new names without updating the schema). Varlock is for docs and `bun run env:validate` / `varlock load`—Convex does not run Varlock; use the Convex dashboard for backend `process.env`.

This project uses [Bun](https://bun.sh) as its package manager and script runner. Install dependencies with `bun install`. Run `package.json` scripts with `bun run <script>` (for example `bun run dev:all` for Vite and Convex together, or `bun run check` for typechecking). For one-off package binaries, use `bunx` instead of `npx` when you want Bun to execute them (for example `bunx convex ai-files install`).

Prefer the existing shared UI primitives in [`src/lib/components/ui`](src/lib/components/ui) whenever possible instead of introducing new raw HTML patterns or duplicate components.

All of the user facing text in this project is in **swedish**. Agentic communication and development, as well as all docs should be mainly written in english. Everything should be UTF-8 encoded.

Product context (important for agents and users): the meeting experience in this app is primarily intended for **in-room meetings** where participants are physically in the same room. It can also be used alongside a video-conferencing tool, but it is not designed as a remote-first meeting platform.

Implication for the simplified (HTTP polling) mode: avoid polling or returning **rapidly-changing live state** that is expected to be visible in the room via **projector/admin/moderator surfaces**. For example, including the **speaker queue** in a simplified snapshot is typically redundant and can be expensive to poll frequently (it may touch a fast-changing set of documents). In the normal realtime Convex participant UI this is less of a concern due to reactive subscriptions, but in polling mode prefer stable, participant-critical state.
