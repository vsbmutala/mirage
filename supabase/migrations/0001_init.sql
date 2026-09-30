-- MPEER schema — Multimodal Public-Profile Entity Resolution & Evidence Retrieval
-- Apply with:  supabase db push   (or paste into the SQL editor)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- persons
create table if not exists public.persons (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  normalized_name text not null,
  summary         text,
  identity_status text not null default 'unresolved'
                  check (identity_status in ('resolved','partial','conflicting','unresolved')),
  confidence      integer not null default 0 check (confidence between 0 and 100),
  profile         jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists persons_normalized_name_idx on public.persons (normalized_name);

-- ------------------------------------------------------------ research_runs
create table if not exists public.research_runs (
  id           uuid primary key default gen_random_uuid(),
  query        text not null,
  input_type   text not null default 'name'
               check (input_type in ('name','image','name+image','demo')),
  status       text not null default 'pending'
               check (status in ('pending','running','completed','failed','conflicting')),
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  metadata     jsonb not null default '{}'::jsonb
);
create index if not exists research_runs_status_idx on public.research_runs (status);
create index if not exists research_runs_started_idx on public.research_runs (started_at desc);

-- ------------------------------------------------------------- candidates
create table if not exists public.candidates (
  id              uuid primary key default gen_random_uuid(),
  research_run_id uuid references public.research_runs(id) on delete cascade,
  person_id       uuid references public.persons(id) on delete set null,
  name            text not null,
  source          text not null
                check (source in ('web_search','github','orcid','google_scholar','linkedin','university','other')),
  source_url      text not null,
  raw_data        jsonb not null default '{}'::jsonb,
  match_score     integer not null default 0 check (match_score between 0 and 100),
  match_status    text not null default 'pending'
                check (match_status in ('pending','high_confidence_match','possible_match','uncertain','likely_different_person','rejected')),
  created_at      timestamptz not null default now()
);
create index if not exists candidates_person_idx on public.candidates (person_id);
create index if not exists candidates_run_idx    on public.candidates (research_run_id);

-- --------------------------------------------------------------- evidence
create table if not exists public.evidence (
  id            uuid primary key default gen_random_uuid(),
  research_run_id uuid references public.research_runs(id) on delete cascade,
  person_id     uuid references public.persons(id) on delete cascade,
  candidate_id  uuid references public.candidates(id) on delete set null,
  claim         text not null,
  evidence_text text not null,
  source_name   text not null,
  source_url    text not null default '',
  evidence_type text not null default 'other'
              check (evidence_type in ('affiliation','education','employment','publication','profile_link','research_topic','website','image_context','location','other')),
  confidence    integer not null default 0 check (confidence between 0 and 100),
  created_at    timestamptz not null default now()
);
create index if not exists evidence_person_idx   on public.evidence (person_id);
create index if not exists evidence_run_idx      on public.evidence (research_run_id);
create index if not exists evidence_type_idx     on public.evidence (evidence_type);

-- ----------------------------------------------------------- publications
create table if not exists public.publications (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid references public.persons(id) on delete cascade,
  title      text not null,
  authors    text[] not null default '{}',
  year       integer,
  venue      text,
  url        text,
  source     text not null,
  created_at timestamptz not null default now()
);
create index if not exists publications_person_idx on public.publications (person_id);
create index if not exists publications_year_idx   on public.publications (year desc);

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid references public.persons(id) on delete cascade,
  platform    text not null,
  username    text,
  url         text not null,
  description text,
  created_at  timestamptz not null default now()
);
create index if not exists profiles_person_idx on public.profiles (person_id);

-- -------------------------------------------------------- row level security
alter table public.persons        enable row level security;
alter table public.research_runs  enable row level security;
alter table public.candidates     enable row level security;
alter table public.evidence       enable row level security;
alter table public.publications   enable row level security;
alter table public.profiles       enable row level security;

-- Public research data is readable via the anon key (it is public-source
-- derived). All writes go through the service role, which bypasses RLS.
create policy "public read persons"        on public.persons        for select using (true);
create policy "public read research_runs"  on public.research_runs  for select using (true);
create policy "public read candidates"     on public.candidates     for select using (true);
create policy "public read evidence"       on public.evidence       for select using (true);
create policy "public read publications"   on public.publications   for select using (true);
create policy "public read profiles"       on public.profiles       for select using (true);
