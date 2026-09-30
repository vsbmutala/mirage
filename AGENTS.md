<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes (MPEER)

- `npm run dev` — dev server on :3000
- `npm run build` / `npx tsc --noEmit` / `npx eslint .` — verification
- `npm run evaluate` — runs `evaluation/evaluate.ts` against `evaluation/benchmark.json`
- All env vars optional: without Supabase the app uses an in-memory store; without OpenAI it falls back to heuristic entity resolution; without a search key it still queries the public GitHub and ORCID APIs.
- `lib/db.ts` is the repository seam (Supabase vs memory). `lib/search.ts` is the pluggable `SearchProvider` seam (tavily/serper/brave/mock).
- The research pipeline lives in `lib/research/pipeline.ts` and runs detached via `after()`; the UI polls `GET /api/research/[id]`.
- Schema + RLS: `supabase/migrations/0001_init.sql`.
