# MPEER

**Multimodal Public-Profile Entity Resolution & Evidence Retrieval**

MPEER is a research-grade prototype that takes a person's **full name** and/or a
**user-authorized image** and builds an evidence-backed professional/academic
profile from permitted public sources (web search, GitHub, ORCID).

The core research idea: identity resolution is treated as an **evidence
problem**. Every claim the system shows carries provenance — a source, an
evidence record, and a confidence signal. The system prefers
*"evidence indicates X from source Y"* over *"X is true"*, and reports
conflicts instead of forcing identity matches.

> ⚠️ **Scope.** MPEER is not a surveillance tool. Images are limited to files
> provided/authorized by the user and are used only to extract contextual
> clues (organizations, events, visible URLs) — never facial identification
> of arbitrary people. It does not bypass access controls, robots.txt,
> paywalls, or private profiles.

---

## Motivation

Professional identity is fragmented across heterogeneous public sources —
university pages, ORCID records, GitHub profiles, citation platforms, personal
sites. Name matching alone produces false merges (common names) and false
splits (name variants). MPEER studies whether **cross-source evidence** and
**multimodal context** can do better.

## Research Questions

1. Can multimodal contextual information improve candidate retrieval?
2. Can cross-source evidence reduce false identity matches?
3. Does evidence-grounded RAG reduce unsupported claims?
4. How does multimodal entity resolution compare with metadata-only matching?

## Architecture

```
User
 │
 ├── Name
 │
 └── Authorized Image
          │
          ▼
    Input Processing        (vision → contextual clues, no face ID)
          │
          ▼
    Query Generation        (base queries + signal-driven expansion)
          │
          ▼
    Public Retrieval        (SearchProvider + GitHub API + ORCID API)
          │
          ▼
   Candidate Generation     (normalized, deduplicated records)
          │
          ▼
  Entity Resolution         (LLM or heuristic → verdicts + conflict flag)
          │
          ▼
    Evidence Graph          (typed nodes/edges with provenance)
          │
          ▼
 Evidence-Grounded RAG      (profile synthesized from evidence only)
          │
          ▼
   Research Dashboard       (tabs, sources, confidence, graph)
```

## Tech Stack

| Layer    | Choice                                                        |
| -------- | ------------------------------------------------------------- |
| Frontend | Next.js App Router, TypeScript, Tailwind CSS, Lucide icons    |
| Graph    | React Flow (`@xyflow/react`)                                  |
| Forms    | React Hook Form + Zod                                          |
| Backend  | Next.js Route Handlers                                        |
| AI       | OpenRouter or OpenAI (chat + vision + embeddings)             |
| Database | Supabase PostgreSQL (RLS enabled), in-memory fallback         |
| Search   | `SearchProvider` abstraction — Tavily / Serper / Brave / mock |

## Installation

```bash
npm install
cp .env.local.example .env.local   # fill in your keys
npm run dev
```

## Environment Variables

All values are optional — the app runs in a degraded mode (in-memory store,
heuristic resolution, no LLM/vision/search) without them.

```bash
# LLM — OpenRouter (preferred) or OpenAI; one key is enough
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENAI_API_KEY=
LLM_MODEL=openai/gpt-4o-mini           # vendor-prefixed id on OpenRouter
LLM_VISION_MODEL=openai/gpt-4o-mini    # must accept image inputs

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

SEARCH_PROVIDER=auto          # auto | tavily | serper | brave | mock
SEARCH_API_KEY=
SEARCH_API_URL=               # provider endpoint, e.g. https://api.tavily.com/search

GITHUB_TOKEN=                 # optional — raises GitHub rate limits
ORCID_CLIENT_ID=              # optional — public ORCID API needs no auth
ORCID_CLIENT_SECRET=
```

The **service-role key is server-only** (`lib/supabase.ts`) and is never
shipped to the browser. `.env`, `.env.local`, `.env.*.local` are gitignored.

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com).
2. Copy `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   (Project Settings → API) into `.env.local`.
3. Apply the migration:

   ```bash
   # with the Supabase CLI
   supabase link --project-ref <ref>
   supabase db push

   # or paste supabase/migrations/0001_init.sql into the SQL editor
   ```

Tables: `persons`, `candidates`, `evidence`, `publications`, `profiles`,
`research_runs` — with foreign keys, indexes, and RLS (public read, writes
only via the service role server-side).

## Running Locally

```bash
npm run dev      # http://localhost:3000
```

Try the **"Try an example"** button — it replays a curated, labelled demo case
through the real pipeline stages (no API keys needed).

## API Architecture

| Route                 | Method | Purpose                                         |
| --------------------- | ------ | ----------------------------------------------- |
| `/api/research`       | POST   | Start a run; pipeline continues via `after()`   |
| `/api/research/[id]`  | GET    | Run status + full result (polled by the UI)     |
| `/api/search`         | POST   | Public-source search through the provider       |
| `/api/vision`         | POST   | Context extraction from an authorized image     |
| `/api/resolve`        | POST   | Entity-resolution verdicts for candidates       |
| `/api/evidence`       | POST   | Evidence rows for a research run                |
| `/api/summarize`      | POST   | Evidence-grounded structured profile            |

## Entity Resolution

`lib/entity-resolution.ts` scores each candidate on: name similarity,
organization overlap, education/publication overlap, GitHub/ORCID structure,
and explicit cross-links between sources. Verdicts are one of
`high_confidence_match / possible_match / uncertain / likely_different_person`,
each with separated *supporting*, *contradictory*, and *missing* evidence.
Two strong-but-unlinked clusters produce a **conflicting** result rather than
a forced merge.

## Multimodal Pipeline

Authorized images go through a constrained vision prompt that extracts only
directly observable/readable information — visible text, organization names,
logos, event names, presentation titles, URLs — each with `value`, `evidence`,
and `confidence`. These clues feed query expansion and appear as
`image_context` evidence. The prompt explicitly forbids naming or
characterizing the depicted person.

## Evidence Graph

Resolved entities render as a React Flow graph — person at the center with
typed edges (`AFFILIATED_WITH`, `AUTHORED`, `WORKED_AT`, `LINKS_TO`,
`RESEARCHES`, `STUDIED_AT`) to organizations, publications, profiles, and
topics. Clicking a node shows its backing evidence records.

## Evaluation

`evaluation/` contains a labelled benchmark (`benchmark.json`) of
same/different-person pairs and a reusable harness (`evaluate.ts`) reporting
**Precision / Recall / F1 / FMR / FNMR** per evidence mode
(`name_only`, `metadata`, `multimodal`).

```bash
npm run evaluate                          # heuristic baseline
npx tsx evaluation/evaluate.ts preds.json # score stored system predictions
```

No benchmark results are fabricated — the file ships labels only.

## Limitations

- In-memory store is used when Supabase isn't configured (data is lost on
  restart; progress polling requires a single server process).
- The search provider is only as good as the configured API; without one,
  retrieval is limited to GitHub/ORCID lookups.
- LLM steps degrade to deterministic heuristics when OpenAI isn't configured.
- Entity resolution is pairwise-to-query, not full clustering.
- Long-running pipeline relies on `after()` — suitable for `next dev` and
  Node deployments; a queue (e.g. Trigger.dev, Inngest) is the right
  production primitive.

## Responsible Use

- Only search for public professional/academic information.
- Only upload images you are authorized to analyze.
- Treat results as research leads, not verified facts — follow the source
  links before relying on any claim.

## Future Research

- Full clustering + transitive merge of candidate graphs.
- Embedding-based similarity as a scored feature alongside LLM verdicts.
- Page-content verification: fetch permitted pages and check that cited
  evidence actually appears on the source.
- Temporal identity tracking (career moves, name changes).
- Human-in-the-loop adjudication UI feeding an expanded benchmark.
