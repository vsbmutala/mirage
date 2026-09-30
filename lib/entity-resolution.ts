import { chatJSON } from "./openai";
import {
  entityResolutionUserPrompt,
  ENTITY_RESOLUTION_SYSTEM_PROMPT,
} from "./prompts";
import { clamp, hostnameOf, nameContainment, tokenSimilarity } from "./utils";
import type { MatchStatus, ResolutionVerdict } from "@/types/candidate";

export interface ResolutionInput {
  id: string;
  name: string;
  source: string;
  source_url: string;
  title?: string;
  snippet?: string;
  raw_data: Record<string, unknown>;
}

export interface ResolutionOutcome {
  verdicts: ResolutionVerdict[];
  conflicting: boolean;
  notes: string;
  method: "llm" | "heuristic";
}

interface LlmVerdict {
  candidate_index: number;
  status: MatchStatus;
  score: number;
  supporting?: string[];
  contradictory?: string[];
  missing?: string[];
}

interface LlmResponse {
  verdicts?: LlmVerdict[];
  conflicting?: boolean;
  notes?: string;
}

function statusForScore(score: number): MatchStatus {
  if (score >= 75) return "high_confidence_match";
  if (score >= 50) return "possible_match";
  if (score >= 30) return "uncertain";
  return "likely_different_person";
}

/** Cross-signal: does this candidate share an org/domain/link with another? */
function crossLinked(a: ResolutionInput, b: ResolutionInput): boolean {
  const textA = `${a.title ?? ""} ${a.snippet ?? ""} ${JSON.stringify(a.raw_data)}`.toLowerCase();
  const textB = `${b.title ?? ""} ${b.snippet ?? ""} ${JSON.stringify(b.raw_data)}`.toLowerCase();
  const hostA = hostnameOf(a.source_url);
  const hostB = hostnameOf(b.source_url);
  if (hostA && hostB && hostA === hostB) return true;
  // shared organization tokens (institutions, companies) between raw_data
  const orgsOf = (r: ResolutionInput): string[] => {
    const raw = r.raw_data as {
      institutions?: string[];
      company?: string | null;
    };
    return [...(raw.institutions ?? []), raw.company ?? ""].filter(
      (x): x is string => Boolean(x)
    );
  };
  for (const org of orgsOf(a)) {
    const o = org.toLowerCase();
    if (o.length > 3 && textB.includes(o)) return true;
  }
  for (const org of orgsOf(b)) {
    const o = org.toLowerCase();
    if (o.length > 3 && textA.includes(o)) return true;
  }
  return false;
}

function heuristicResolve(
  queryName: string,
  candidates: ResolutionInput[]
): ResolutionOutcome {
  const verdicts: ResolutionVerdict[] = candidates.map((c) => {
    const nameSim = Math.max(
      tokenSimilarity(queryName, c.name),
      tokenSimilarity(queryName, c.title ?? "")
    );
    // People-search signal: what fraction of the queried name appears in the
    // candidate's name/title/snippet. A rare full name fully present on the
    // page is strong evidence the record is about that person.
    const containment = nameContainment(
      queryName,
      `${c.name} ${c.title ?? ""} ${c.snippet ?? ""}`
    );
    let score = Math.max(nameSim * 55, containment * 62);
    const supporting: string[] = [];
    const missing: string[] = [];
    const contradictory: string[] = [];

    if (nameSim > 0.6 || containment >= 0.9)
      supporting.push("Name appears in result");
    else missing.push("Weak name overlap");

    // cross-link bonus: up to +30
    let links = 0;
    for (const other of candidates) {
      if (other.id === c.id) continue;
      if (crossLinked(c, other)) links++;
    }
    if (links > 0) {
      score += Math.min(30, links * 12);
      supporting.push(`Cross-referenced by ${links} other source(s)`);
    } else {
      missing.push("No cross-source corroboration");
    }

    // authoritative source bonus
    if (c.source === "orcid" || c.source === "github") {
      score += 15;
      supporting.push(`Structured public record (${c.source})`);
    }
    if (c.source === "google_scholar" || c.source === "university") {
      score += 10;
      supporting.push("Academic source");
    }

    return {
      candidateId: c.id,
      status: statusForScore(clamp(score, 0, 95)),
      score: clamp(score, 0, 95),
      supporting,
      contradictory,
      missing,
    };
  });

  // Conflict heuristic: build cross-linked clusters (transitive closure) and
  // flag a conflict only when at least two *unlinked* clusters each contain a
  // high-confidence candidate — i.e. two mutually unsupported, well-evidenced
  // identity hypotheses. Absence of a cross-link alone is not evidence of
  // difference, so weak clusters do not trigger a conflict.
  const parent = new Map<string, string>(candidates.map((c) => [c.id, c.id]));
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      if (crossLinked(candidates[i], candidates[j])) {
        parent.set(find(candidates[i].id), find(candidates[j].id));
      }
    }
  }
  const clusterBest = new Map<string, number>();
  for (const v of verdicts) {
    const root = find(v.candidateId);
    clusterBest.set(root, Math.max(clusterBest.get(root) ?? 0, v.score));
  }
  const strongClusters = [...clusterBest.values()].filter((s) => s >= 75).length;
  const conflicting = strongClusters >= 2;

  return {
    verdicts,
    conflicting,
    notes: "Heuristic matching (OpenAI not configured)",
    method: "heuristic",
  };
}

/**
 * Resolves whether retrieved candidate records refer to the same person.
 * Uses the LLM when configured, otherwise a deterministic heuristic so the
 * pipeline still works offline.
 */
export async function resolveCandidates(
  queryName: string,
  candidates: ResolutionInput[]
): Promise<ResolutionOutcome> {
  if (candidates.length === 0) {
    return { verdicts: [], conflicting: false, notes: "No candidates", method: "heuristic" };
  }

  const llmPayload = candidates.map((c, i) => ({
    index: i,
    name: c.name,
    source: c.source,
    url: c.source_url,
    title: c.title,
    snippet: c.snippet?.slice(0, 500),
    raw_data: c.raw_data,
  }));

  const llm = await chatJSON<LlmResponse>(
    ENTITY_RESOLUTION_SYSTEM_PROMPT,
    entityResolutionUserPrompt(queryName, llmPayload),
    // gpt-5/o-series spend reasoning tokens inside max_completion_tokens, and
    // a verdict per candidate needs real output room — 12k covers ~40 verdicts.
    { maxTokens: 12000, timeoutMs: 90_000 }
  );

  if (!llm || !Array.isArray(llm.verdicts)) {
    return heuristicResolve(queryName, candidates);
  }

  const verdicts: ResolutionVerdict[] = candidates.map((c, i) => {
    const v = llm.verdicts!.find((x) => x.candidate_index === i);
    if (!v) {
      return {
        candidateId: c.id,
        status: "uncertain",
        score: 40,
        supporting: [],
        contradictory: [],
        missing: ["Not evaluated by resolver"],
      };
    }
    return {
      candidateId: c.id,
      status: v.status ?? "uncertain",
      score: clamp(typeof v.score === "number" ? v.score : 40),
      supporting: v.supporting ?? [],
      contradictory: v.contradictory ?? [],
      missing: v.missing ?? [],
    };
  });

  return {
    verdicts,
    conflicting: Boolean(llm.conflicting),
    notes: llm.notes ?? "",
    method: "llm",
  };
}
