import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "./supabase";
import { normalizeName } from "./utils";
import type { Candidate } from "@/types/candidate";
import type { NewCandidateRow, PersonRow } from "./db-types";
import type {
  NewEvidence,
  Evidence,
  EvidenceGraph,
} from "@/types/evidence";
import type { NewPublication, NewPublicProfile, Publication, PublicProfile } from "@/types/publication";
import type {
  InputType,
  Person,
  PipelineStage,
  ResearchResult,
  ResearchRun,
  RunStatus,
  StageInfo,
  StructuredProfile,
} from "@/types/research-bridge";

export type {
  PersonRow,
  NewCandidateRow,
};

export interface NewRun {
  query: string;
  input_type: InputType;
  metadata?: Record<string, unknown>;
}

/**
 * Repository abstraction. Uses Supabase when configured, otherwise an
 * in-memory store so the prototype runs end-to-end without credentials.
 */
export interface Repo {
  createRun(input: NewRun): Promise<ResearchRun>;
  setStage(runId: string, stage: PipelineStage, detail?: string): Promise<void>;
  completeRun(runId: string, extra?: Record<string, unknown>): Promise<void>;
  failRun(runId: string, message: string): Promise<void>;
  markConflicting(runId: string, extra?: Record<string, unknown>): Promise<void>;
  getRun(runId: string): Promise<ResearchRun | null>;

  createPerson(input: {
    name: string;
    summary?: string | null;
    identity_status?: Person["identity_status"];
    confidence?: number;
    profile?: StructuredProfile | null;
  }): Promise<Person>;
  updatePerson(
    id: string,
    patch: Partial<Pick<Person, "summary" | "identity_status" | "confidence">> & {
      profile?: StructuredProfile | null;
    }
  ): Promise<void>;

  insertCandidates(rows: NewCandidateRow[]): Promise<Candidate[]>;
  updateCandidate(
    id: string,
    patch: Partial<Pick<Candidate, "match_score" | "match_status" | "person_id">>
  ): Promise<void>;

  insertEvidence(rows: NewEvidence[]): Promise<Evidence[]>;
  insertPublications(rows: NewPublication[]): Promise<Publication[]>;
  insertProfiles(rows: NewPublicProfile[]): Promise<PublicProfile[]>;

  saveGraph(runId: string, graph: EvidenceGraph): Promise<void>;
  getResult(runId: string): Promise<ResearchResult | null>;
}

/* ------------------------------ Supabase ------------------------------ */

function runFromRow(row: Record<string, unknown>): ResearchRun {
  const md = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    id: row.id as string,
    query: row.query as string,
    input_type: row.input_type as InputType,
    status: row.status as RunStatus,
    stage: (md.stage as PipelineStage) ?? "processing_input",
    stages: (md.stages as StageInfo[]) ?? [],
    error: (md.error as string) ?? null,
    started_at: row.started_at as string,
    completed_at: (row.completed_at as string) ?? null,
    metadata: md,
  };
}

class SupabaseRepo implements Repo {
  private db() {
    const sb = getSupabaseAdmin();
    if (!sb) throw new Error("Supabase not configured");
    return sb;
  }

  private async mergeMetadata(runId: string, patch: Record<string, unknown>) {
    const { data } = await this.db()
      .from("research_runs")
      .select("metadata")
      .eq("id", runId)
      .single();
    const md = { ...((data?.metadata as object) ?? {}), ...patch };
    await this.db().from("research_runs").update({ metadata: md }).eq("id", runId);
  }

  async createRun(input: NewRun): Promise<ResearchRun> {
    const stages: StageInfo[] = [];
    const { data, error } = await this.db()
      .from("research_runs")
      .insert({
        query: input.query,
        input_type: input.input_type,
        status: "running",
        metadata: { ...input.metadata, stage: "processing_input", stages },
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return runFromRow(data);
  }

  async setStage(runId: string, stage: PipelineStage, detail?: string) {
    const { data } = await this.db()
      .from("research_runs")
      .select("metadata")
      .eq("id", runId)
      .single();
    const md = (data?.metadata ?? {}) as { stages?: StageInfo[] };
    const stages: StageInfo[] = md.stages ?? [];
    const existing = stages.find((s) => s.stage === stage);
    if (existing) {
      existing.status = "active";
      existing.detail = detail;
    } else {
      stages.push({ stage, status: "active", detail });
    }
    // mark previous stages done
    for (let i = 0; i < stages.length - 1; i++) {
      if (stages[i].status === "active") {
        stages[i].status = "done";
        stages[i].completedAt = new Date().toISOString();
      }
    }
    await this.mergeMetadata(runId, { stage, stages });
  }

  async completeRun(runId: string, extra?: Record<string, unknown>) {
    await this.mergeMetadata(runId, { stage: "completed", ...extra });
    await this.db()
      .from("research_runs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", runId);
  }

  async markConflicting(runId: string, extra?: Record<string, unknown>) {
    await this.mergeMetadata(runId, { stage: "completed", ...extra });
    await this.db()
      .from("research_runs")
      .update({ status: "conflicting", completed_at: new Date().toISOString() })
      .eq("id", runId);
  }

  async failRun(runId: string, message: string) {
    await this.mergeMetadata(runId, { error: message });
    await this.db()
      .from("research_runs")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", runId);
  }

  async getRun(runId: string): Promise<ResearchRun | null> {
    const { data } = await this.db()
      .from("research_runs")
      .select("*")
      .eq("id", runId)
      .single();
    return data ? runFromRow(data) : null;
  }

  async createPerson(input: {
    name: string;
    summary?: string | null;
    identity_status?: Person["identity_status"];
    confidence?: number;
    profile?: StructuredProfile | null;
  }): Promise<Person> {
    const { data, error } = await this.db()
      .from("persons")
      .insert({
        name: input.name,
        normalized_name: normalizeName(input.name),
        summary: input.summary ?? null,
        identity_status: input.identity_status ?? "unresolved",
        confidence: input.confidence ?? 0,
        profile: input.profile ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Person;
  }

  async updatePerson(
    id: string,
    patch: Partial<Pick<Person, "summary" | "identity_status" | "confidence">> & {
      profile?: StructuredProfile | null;
    }
  ) {
    await this.db()
      .from("persons")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  async insertCandidates(rows: NewCandidateRow[]): Promise<Candidate[]> {
    if (rows.length === 0) return [];
    const { data, error } = await this.db()
      .from("candidates")
      .insert(rows)
      .select();
    if (error) throw new Error(error.message);
    return data as Candidate[];
  }

  async updateCandidate(
    id: string,
    patch: Partial<Pick<Candidate, "match_score" | "match_status" | "person_id">>
  ) {
    await this.db().from("candidates").update(patch).eq("id", id);
  }

  async insertEvidence(rows: NewEvidence[]): Promise<Evidence[]> {
    if (rows.length === 0) return [];
    const { data, error } = await this.db()
      .from("evidence")
      .insert(rows)
      .select();
    if (error) throw new Error(error.message);
    return data as Evidence[];
  }

  async insertPublications(rows: NewPublication[]): Promise<Publication[]> {
    if (rows.length === 0) return [];
    const { data, error } = await this.db()
      .from("publications")
      .insert(rows)
      .select();
    if (error) throw new Error(error.message);
    return data as Publication[];
  }

  async insertProfiles(rows: NewPublicProfile[]): Promise<PublicProfile[]> {
    if (rows.length === 0) return [];
    const { data, error } = await this.db()
      .from("profiles")
      .insert(rows)
      .select();
    if (error) throw new Error(error.message);
    return data as PublicProfile[];
  }

  async saveGraph(runId: string, graph: EvidenceGraph) {
    await this.mergeMetadata(runId, { graph });
  }

  async getResult(runId: string): Promise<ResearchResult | null> {
    const run = await this.getRun(runId);
    if (!run) return null;
    const personId = (run.metadata.person_id as string) ?? null;

    const [personRes, candRes, evRes, pubRes, profRes] = await Promise.all([
      personId
        ? this.db().from("persons").select("*").eq("id", personId).single()
        : Promise.resolve({ data: null }),
      this.db().from("candidates").select("*").eq("research_run_id", runId),
      personId
        ? this.db().from("evidence").select("*").eq("person_id", personId)
        : this.db().from("evidence").select("*").eq("research_run_id", runId),
      personId
        ? this.db().from("publications").select("*").eq("person_id", personId)
        : Promise.resolve({ data: [] }),
      personId
        ? this.db().from("profiles").select("*").eq("person_id", personId)
        : Promise.resolve({ data: [] }),
    ]);

    const person = (personRes.data as PersonRow | null) ?? null;
    return {
      run,
      person,
      profile: (person?.profile as StructuredProfile | null) ?? null,
      candidates: (candRes.data as Candidate[]) ?? [],
      evidence: (evRes.data as Evidence[]) ?? [],
      publications: (pubRes.data as Publication[]) ?? [],
      profiles: (profRes.data as PublicProfile[]) ?? [],
      graph: (run.metadata.graph as EvidenceGraph) ?? { nodes: [], edges: [] },
    };
  }
}

/* ------------------------------ In-memory ------------------------------ */

interface MemStore {
  runs: Map<string, ResearchRun>;
  persons: Map<string, Person & { profile?: StructuredProfile | null }>;
  candidates: Map<string, Candidate & { research_run_id?: string }>;
  evidence: Map<string, Evidence & { research_run_id?: string }>;
  publications: Map<string, Publication>;
  profiles: Map<string, PublicProfile>;
}

const globalStore = globalThis as unknown as { __mpeerStore?: MemStore };
const store: MemStore =
  globalStore.__mpeerStore ??
  (globalStore.__mpeerStore = {
    runs: new Map(),
    persons: new Map(),
    candidates: new Map(),
    evidence: new Map(),
    publications: new Map(),
    profiles: new Map(),
  });

class MemoryRepo implements Repo {
  private runToRunId = new Map<string, string>();

  async createRun(input: NewRun): Promise<ResearchRun> {
    const run: ResearchRun = {
      id: randomUUID(),
      query: input.query,
      input_type: input.input_type,
      status: "running",
      stage: "processing_input",
      stages: [],
      error: null,
      started_at: new Date().toISOString(),
      completed_at: null,
      metadata: input.metadata ?? {},
    };
    store.runs.set(run.id, run);
    return run;
  }

  async setStage(runId: string, stage: PipelineStage, detail?: string) {
    const run = store.runs.get(runId);
    if (!run) return;
    run.stage = stage;
    for (const s of run.stages) {
      if (s.status === "active") {
        s.status = "done";
        s.completedAt = new Date().toISOString();
      }
    }
    const existing = run.stages.find((s) => s.stage === stage);
    if (existing) {
      existing.status = "active";
      existing.detail = detail;
    } else {
      run.stages.push({ stage, status: "active", detail });
    }
  }

  async completeRun(runId: string, extra?: Record<string, unknown>) {
    const run = store.runs.get(runId);
    if (!run) return;
    run.status = "completed";
    run.stage = "completed";
    run.completed_at = new Date().toISOString();
    run.metadata = { ...run.metadata, ...extra };
    for (const s of run.stages) if (s.status === "active") s.status = "done";
  }

  async markConflicting(runId: string, extra?: Record<string, unknown>) {
    const run = store.runs.get(runId);
    if (!run) return;
    run.status = "conflicting";
    run.stage = "completed";
    run.completed_at = new Date().toISOString();
    run.metadata = { ...run.metadata, ...extra };
    for (const s of run.stages) if (s.status === "active") s.status = "done";
  }

  async failRun(runId: string, message: string) {
    const run = store.runs.get(runId);
    if (!run) return;
    run.status = "failed";
    run.error = message;
    run.completed_at = new Date().toISOString();
    for (const s of run.stages) if (s.status === "active") s.status = "failed";
  }

  async getRun(runId: string) {
    return store.runs.get(runId) ?? null;
  }

  async createPerson(input: {
    name: string;
    summary?: string | null;
    identity_status?: Person["identity_status"];
    confidence?: number;
    profile?: StructuredProfile | null;
  }): Promise<Person> {
    const now = new Date().toISOString();
    const person: Person & { profile?: StructuredProfile | null } = {
      id: randomUUID(),
      name: input.name,
      normalized_name: normalizeName(input.name),
      summary: input.summary ?? null,
      identity_status: input.identity_status ?? "unresolved",
      confidence: input.confidence ?? 0,
      created_at: now,
      updated_at: now,
      profile: input.profile ?? null,
    };
    store.persons.set(person.id, person);
    return person;
  }

  async updatePerson(
    id: string,
    patch: Partial<Pick<Person, "summary" | "identity_status" | "confidence">> & {
      profile?: StructuredProfile | null;
    }
  ) {
    const p = store.persons.get(id);
    if (!p) return;
    Object.assign(p, patch, { updated_at: new Date().toISOString() });
  }

  async insertCandidates(rows: NewCandidateRow[]): Promise<Candidate[]> {
    return rows.map((r) => {
      const c: Candidate & { research_run_id?: string } = {
        id: randomUUID(),
        person_id: r.person_id ?? null,
        name: r.name,
        source: r.source,
        source_url: r.source_url,
        raw_data: r.raw_data ?? {},
        match_score: r.match_score ?? 0,
        match_status: r.match_status ?? "pending",
        created_at: new Date().toISOString(),
        research_run_id: r.research_run_id,
      };
      store.candidates.set(c.id, c);
      if (r.research_run_id) this.runToRunId.set(c.id, r.research_run_id);
      return c;
    });
  }

  async updateCandidate(
    id: string,
    patch: Partial<Pick<Candidate, "match_score" | "match_status" | "person_id">>
  ) {
    const c = store.candidates.get(id);
    if (c) Object.assign(c, patch);
  }

  async insertEvidence(rows: NewEvidence[]): Promise<Evidence[]> {
    return rows.map((r) => {
      const e: Evidence & { research_run_id?: string } = {
        id: randomUUID(),
        person_id: r.person_id ?? null,
        candidate_id: r.candidate_id ?? null,
        claim: r.claim,
        evidence_text: r.evidence_text,
        source_name: r.source_name,
        source_url: r.source_url,
        evidence_type: r.evidence_type,
        confidence: r.confidence,
        created_at: new Date().toISOString(),
        research_run_id: (r as { research_run_id?: string }).research_run_id,
      };
      store.evidence.set(e.id, e);
      return e;
    });
  }

  async insertPublications(rows: NewPublication[]): Promise<Publication[]> {
    return rows.map((r) => {
      const p: Publication = {
        id: randomUUID(),
        person_id: r.person_id ?? null,
        title: r.title,
        authors: r.authors,
        year: r.year ?? null,
        venue: r.venue ?? null,
        url: r.url ?? null,
        source: r.source,
        created_at: new Date().toISOString(),
      };
      store.publications.set(p.id, p);
      return p;
    });
  }

  async insertProfiles(rows: NewPublicProfile[]): Promise<PublicProfile[]> {
    return rows.map((r) => {
      const p: PublicProfile = {
        id: randomUUID(),
        person_id: r.person_id ?? null,
        platform: r.platform,
        username: r.username ?? null,
        url: r.url,
        description: r.description ?? null,
        created_at: new Date().toISOString(),
      };
      store.profiles.set(p.id, p);
      return p;
    });
  }

  async saveGraph(runId: string, graph: EvidenceGraph) {
    const run = store.runs.get(runId);
    if (run) run.metadata = { ...run.metadata, graph };
  }

  async getResult(runId: string): Promise<ResearchResult | null> {
    const run = store.runs.get(runId);
    if (!run) return null;
    const personId = (run.metadata.person_id as string) ?? null;
    const person = personId ? (store.persons.get(personId) ?? null) : null;
    return {
      run,
      person,
      profile: (person as { profile?: StructuredProfile | null } | null)?.profile ?? null,
      candidates: [...store.candidates.values()].filter(
        (c) => c.research_run_id === runId || (personId && c.person_id === personId)
      ),
      evidence: [...store.evidence.values()].filter(
        (e) => e.research_run_id === runId || (personId && e.person_id === personId)
      ),
      publications: [...store.publications.values()].filter(
        (p) => personId && p.person_id === personId
      ),
      profiles: [...store.profiles.values()].filter(
        (p) => personId && p.person_id === personId
      ),
      graph: (run.metadata.graph as EvidenceGraph) ?? { nodes: [], edges: [] },
    };
  }
}

/* ------------------------------ Selector ------------------------------ */

let repo: Repo | null = null;

export function getRepo(): Repo {
  if (!repo) {
    repo = getSupabaseAdmin() ? new SupabaseRepo() : new MemoryRepo();
    if (repo instanceof MemoryRepo) {
      console.warn("[db] Supabase not configured — using in-memory store (data lost on restart)");
    }
  }
  return repo;
}
