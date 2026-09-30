import { hostnameOf } from "./utils";
import type { Candidate } from "@/types/candidate";
import type {
  EdgeRelation,
  Evidence,
  EvidenceGraph,
  GraphNode,
  NewEvidence,
} from "@/types/evidence";
import type { Publication, PublicProfile } from "@/types/publication";
import type { StructuredProfile } from "@/types/person";
import type { VisionClue } from "@/types/research";

/** Convert an accepted candidate into evidence rows. */
export function candidateToEvidence(c: Candidate, queryName: string): NewEvidence {
  const host = hostnameOf(c.source_url);
  return {
    person_id: c.person_id,
    candidate_id: c.id,
    claim: `${queryName} has a public record on ${host}`,
    evidence_text:
      (c.raw_data.snippet as string) ||
      (c.raw_data.title as string) ||
      `${c.name} — ${host}`,
    source_name: c.source === "web_search" ? host : c.source,
    source_url: c.source_url,
    evidence_type:
      c.source === "github" || c.source === "orcid" || c.source === "linkedin"
        ? "profile_link"
        : "other",
    confidence: c.match_score,
  };
}

export function visionCluesToEvidence(clues: VisionClue[], personId?: string): NewEvidence[] {
  return clues
    .filter((c) => c.value)
    .map((c) => ({
      person_id: personId ?? null,
      candidate_id: null,
      claim: `Image context: ${c.category} = ${c.value}`,
      evidence_text: c.evidence,
      source_name: "user-provided image",
      source_url: "",
      evidence_type: "image_context" as const,
      confidence: c.confidence,
    }));
}

const RELATION_BY_TYPE: Record<string, EdgeRelation> = {
  university: "AFFILIATED_WITH",
  organization: "WORKED_AT",
  publication: "AUTHORED",
  github: "LINKS_TO",
  orcid: "LINKS_TO",
  website: "LINKS_TO",
  topic: "RESEARCHES",
};

let edgeSeq = 0;
function edge(source: string, target: string, relation: EdgeRelation) {
  return { id: `e${++edgeSeq}`, source, target, relation };
}

/**
 * Builds the evidence graph shown on the results page. Nodes are derived only
 * from stored evidence/publications/profiles — nothing is invented.
 */
export function buildEvidenceGraph(input: {
  personName: string;
  profile: StructuredProfile | null;
  evidence: Evidence[];
  publications: Publication[];
  profiles: PublicProfile[];
}): EvidenceGraph {
  const { personName, profile, evidence, publications, profiles } = input;
  const nodes: GraphNode[] = [
    { id: "person", type: "person", label: personName },
  ];
  const edges: ReturnType<typeof edge>[] = [];
  const seen = new Set<string>(["person"]);

  const evidenceIdsFor = (needle: string): string[] =>
    evidence
      .filter((e) =>
        `${e.claim} ${e.evidence_text} ${e.source_url}`
          .toLowerCase()
          .includes(needle.toLowerCase())
      )
      .map((e) => e.id);

  const addNode = (id: string, node: GraphNode, relation: EdgeRelation) => {
    if (seen.has(id)) return;
    seen.add(id);
    nodes.push(node);
    edges.push(edge("person", id, relation));
  };

  for (const edu of profile?.education ?? []) {
    const id = `org:${edu.institution}`;
    addNode(id, { id, type: "university", label: edu.institution, evidenceIds: edu.evidenceIds }, "STUDIED_AT");
  }
  for (const job of profile?.employment ?? []) {
    const id = `org:${job.organization}`;
    addNode(id, { id, type: "organization", label: job.organization, evidenceIds: job.evidenceIds }, "WORKED_AT");
  }
  for (const p of profiles) {
    const id = `profile:${p.id}`;
    const type: GraphNode["type"] =
      p.platform === "github" ? "github" : p.platform === "orcid" ? "orcid" : "website";
    addNode(id, { id, type, label: `${p.platform}${p.username ? `: ${p.username}` : ""}`, url: p.url, evidenceIds: evidenceIdsFor(p.url) }, "LINKS_TO");
  }
  for (const pub of publications.slice(0, 12)) {
    const id = `pub:${pub.id}`;
    addNode(id, { id, type: "publication", label: pub.title, url: pub.url ?? undefined }, "AUTHORED");
  }
  for (const topic of (profile?.researchAreas ?? []).slice(0, 8)) {
    const id = `topic:${topic}`;
    addNode(id, { id, type: "topic", label: topic }, "RESEARCHES");
  }

  return { nodes, edges: edges as EvidenceGraph["edges"] };
}

/** Map a 0-100 score to a coarse label for UI copy. */
export function confidenceLabel(score: number): "high" | "medium" | "low" {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

/**
 * Best-effort evidence linking for deterministic/demofallback facts:
 * returns ids of evidence rows sharing a significant token with `text`.
 */
export function attachEvidenceIds(text: string, evidence: Evidence[]): string[] {
  const words = text
    .split(/[^A-Za-z0-9À-ÿ]+/)
    .filter((w) => w.length >= 4)
    .map((w) => w.toLowerCase());
  const ids: string[] = [];
  for (const e of evidence) {
    const hay = `${e.claim} ${e.evidence_text} ${e.source_name}`.toLowerCase();
    if (words.some((w) => hay.includes(w))) ids.push(e.id);
    if (ids.length >= 3) break;
  }
  return ids;
}

export { RELATION_BY_TYPE };
