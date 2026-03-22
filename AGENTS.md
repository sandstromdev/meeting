<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `src/convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

<!-- convex-ai-end -->

This project uses [Bun](https://bun.sh) as its package manager and script runner. Install dependencies with `bun install`. Run `package.json` scripts with `bun run <script>` (for example `bun run dev:all` for Vite and Convex together, or `bun run check` for typechecking). For one-off package binaries, use `bunx` instead of `npx` when you want Bun to execute them (for example `bunx convex ai-files install`).

All of the user facing text in this project is in **swedish**, but developed in english. Everything should be UTF-8 encoded.
