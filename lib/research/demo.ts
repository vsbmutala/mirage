import testCases from "@/data/test-cases.json";
import { getRepo } from "../db";
import { attachEvidenceIds, buildEvidenceGraph } from "../evidence";
import { sleep } from "../utils";
import type { StructuredProfile } from "@/types/person";

interface DemoCase {
  id: string;
  name: string;
  identity_status: "resolved" | "partial" | "conflicting" | "unresolved";
  confidence: number;
  profile: StructuredProfile;
  candidates: {
    name: string;
    source: string;
    source_url: string;
    match_score: number;
    match_status: string;
    title?: string;
    snippet?: string;
  }[];
  evidence: {
    claim: string;
    evidence_text: string;
    source_name: string;
    source_url: string;
    evidence_type: string;
    confidence: number;
  }[];
  publications: {
    title: string;
    authors: string[];
    year?: number | null;
    venue?: string | null;
    url?: string | null;
    source: string;
  }[];
  profiles: {
    platform: string;
    username?: string | null;
    url: string;
    description?: string | null;
  }[];
}

export function listDemoCases(): { id: string; name: string }[] {
  return (testCases.cases as DemoCase[]).map((c) => ({ id: c.id, name: c.name }));
}

/**
 * Demo pipeline — replays a curated, clearly-labelled case through the same
 * stages as the live pipeline so the UX is identical. Data is static and only
 * covers well-known public figures.
 */
export async function runDemoPipeline(runId: string, demoId: string) {
  const repo = getRepo();
  const demo = (testCases.cases as DemoCase[]).find((c) => c.id === demoId);
  if (!demo) {
    await repo.failRun(runId, `Unknown demo case: ${demoId}`);
    return;
  }

  await repo.setStage(runId, "processing_input", "Loading demo case");
  await sleep(400);
  await repo.setStage(runId, "generating_queries", "7 queries generated");
  await sleep(400);
  await repo.setStage(runId, "searching_sources", "Replaying curated retrieval");
  await sleep(600);

  const stored = await repo.insertCandidates(
    demo.candidates.map((c) => ({
      research_run_id: runId,
      name: c.name,
      source: c.source as never,
      source_url: c.source_url,
      match_score: c.match_score,
      match_status: c.match_status as never,
      raw_data: { title: c.title, snippet: c.snippet, demo: true },
    }))
  );

  await repo.setStage(runId, "resolving_identities", "Cross-checking sources");
  await sleep(600);

  const person = await repo.createPerson({
    name: demo.name,
    identity_status: demo.identity_status,
    confidence: demo.confidence,
    profile: demo.profile,
    summary: demo.profile.summary,
  });
  for (const c of stored) {
    await repo.updateCandidate(c.id, { person_id: person.id });
  }

  await repo.setStage(runId, "collecting_evidence", "Attaching evidence");
  const evidence = await repo.insertEvidence(
    demo.evidence.map((e, i) => ({
      person_id: person.id,
      candidate_id: stored[i % stored.length]?.id ?? null,
      claim: e.claim,
      evidence_text: e.evidence_text,
      source_name: e.source_name,
      source_url: e.source_url,
      evidence_type: e.evidence_type as never,
      confidence: e.confidence,
    }))
  );
  const pubs = await repo.insertPublications(
    demo.publications.map((p) => ({ ...p, person_id: person.id }))
  );
  const profiles = await repo.insertProfiles(
    demo.profiles.map((p) => ({ ...p, person_id: person.id }))
  );
  await sleep(500);

  await repo.setStage(runId, "generating_summary", "Grounded profile ready");
  await sleep(400);

  // Backfill evidenceIds on the stored profile so the graph/UI can trace claims.
  const profile: StructuredProfile = {
    ...demo.profile,
    education: demo.profile.education.map((e) => ({
      ...e,
      evidenceIds: evidence
        .filter((x) => x.evidence_type === "education" || x.claim.includes(e.institution))
        .map((x) => x.id),
    })),
    employment: demo.profile.employment.map((e) => ({
      ...e,
      evidenceIds: evidence
        .filter((x) => x.claim.includes(e.organization))
        .map((x) => x.id),
    })),
    biography: (demo.profile.biography ?? []).map((b) => ({
      text: b.text,
      evidenceIds:
        b.evidenceIds && b.evidenceIds.length > 0
          ? b.evidenceIds
          : attachEvidenceIds(b.text, evidence),
    })),
  };
  await repo.updatePerson(person.id, { profile, summary: profile.summary });

  await repo.setStage(runId, "building_graph", "Building evidence graph");
  const graph = buildEvidenceGraph({
    personName: demo.name,
    profile,
    evidence,
    publications: pubs,
    profiles,
  });
  await repo.saveGraph(runId, graph);
  await sleep(400);

  await repo.completeRun(runId, {
    person_id: person.id,
    resolution: { method: "demo", notes: "Curated demo case", conflicting: false },
  });
}
