import { getRepo } from "../db";
import { getSearchProvider, type SearchResult } from "../search";
import { searchGitHubUsers, getUserRepos, gitHubUserToCandidate, reposToEvidenceItems } from "../github";
import { searchOrcid, getOrcidRecord, getOrcidWorks, orcidToCandidate } from "../orcid";
import { resolveCandidates, type ResolutionInput } from "../entity-resolution";
import {
  buildEvidenceGraph,
  candidateToEvidence,
  visionCluesToEvidence,
} from "../evidence";
import { chatJSON } from "../openai";
import {
  PROFILE_SYNTHESIS_SYSTEM_PROMPT,
  profileSynthesisUserPrompt,
} from "../prompts";
import {
  clamp,
  detectPlatform,
  hostnameOf,
  nameContainment,
  sleep,
  tokenSimilarity,
  usernameFromUrl,
} from "../utils";
import { baseQueries, expandQueries, signalsFromVision } from "./queries";
import type { CandidateSource, RawCandidate } from "@/types/candidate";
import type { NewEvidence } from "@/types/evidence";
import type { StructuredProfile } from "@/types/person";
import type { NewProfile, NewPublication } from "@/types/publication-bridge";
import type { VisionClue } from "@/types/research";
import { runDemoPipeline } from "./demo";

export interface PipelineInput {
  name?: string;
  visionClues?: VisionClue[];
  demoId?: string;
}

function classifySource(url: string): CandidateSource {
  const h = hostnameOf(url);
  if (h.includes("github.com")) return "github";
  if (h.includes("orcid.org")) return "orcid";
  if (h.includes("scholar.google")) return "google_scholar";
  if (h.includes("linkedin.com")) return "linkedin";
  if (h.endsWith(".edu") || h.includes("ac.uk") || h.includes("edu.")) return "university";
  return "web_search";
}

function resultToCandidate(r: SearchResult): RawCandidate {
  return {
    name: r.title.replace(/\s*[-|–—].*$/, "").trim() || r.title,
    source: classifySource(r.url),
    source_url: r.url,
    title: r.title,
    snippet: r.snippet,
    raw_data: { title: r.title, snippet: r.snippet, provider: r.provider },
  };
}

/**
 * Entry point — runs asynchronously after /api/research returns the run id.
 * All failures are captured on the run record so the UI can render an error
 * state instead of a blank screen.
 */
export async function runPipeline(runId: string, input: PipelineInput) {
  const repo = getRepo();
  try {
    if (input.demoId) {
      await runDemoPipeline(runId, input.demoId);
      return;
    }
    const name = (input.name ?? "").trim();
    if (!name) throw new Error("A name is required for research.");

    // ---- Stage 1: input processing (vision clues arrive pre-extracted) ----
    await repo.setStage(runId, "processing_input", "Normalizing input");
    const visionClues = input.visionClues ?? [];

    // ---- Stage 2: query generation ----
    await repo.setStage(runId, "generating_queries", "Generating search queries");
    const visionSignals = signalsFromVision(visionClues);
    const provider = getSearchProvider();
    // The key-free fallback scrapes public SERPs; modifier queries ("name"
    // LinkedIn, "name" biography) get degraded/junk results there, so it only
    // runs the bare-name forms. Real search APIs handle all query variants.
    const queries =
      provider.name === "web-fallback"
        ? [`"${name}"`, name]
        : [...baseQueries(name), ...expandQueries(name, visionSignals)];

    // ---- Stage 3: public source retrieval ----
    await repo.setStage(runId, "searching_sources", `Running ${queries.length} queries`);
    const seen = new Set<string>();
    const rawCandidates: RawCandidate[] = [];

    // Batch queries — a few parallel calls is fine for real APIs, and keeps
    // the key-free fallback under its rate limits.
    const BATCH = 4;
    for (let i = 0; i < queries.length; i += BATCH) {
      const batch = await Promise.allSettled(
        queries.slice(i, i + BATCH).map((q) => provider.search(q, 6))
      );
      for (const res of batch) {
        if (res.status !== "fulfilled") continue;
        for (const r of res.value) {
          if (seen.has(r.url)) continue;
          // Junk filter: scraped engines sometimes return trending/degraded
          // pages. A people-search result must mention at least half the
          // queried name in its title/snippet/URL.
          if (
            nameContainment(name, `${r.title} ${r.snippet} ${r.url}`) < 0.5
          )
            continue;
          seen.add(r.url);
          rawCandidates.push(resultToCandidate(r));
        }
      }
    }

    const [ghUsers, orcidHits] = await Promise.all([
      searchGitHubUsers(name).catch(() => []),
      searchOrcid(name).catch(() => []),
    ]);
    for (const u of ghUsers) {
      if (!seen.has(u.html_url)) {
        seen.add(u.html_url);
        rawCandidates.push(gitHubUserToCandidate(u));
      }
    }
    for (const o of orcidHits) {
      if (!seen.has(o.url)) {
        seen.add(o.url);
        rawCandidates.push(orcidToCandidate(o));
      }
    }

    const stored = await repo.insertCandidates(
      rawCandidates.slice(0, 40).map((c) => ({
        research_run_id: runId,
        name: c.name,
        source: c.source,
        source_url: c.source_url,
        raw_data: { ...c.raw_data, title: c.title, snippet: c.snippet },
      }))
    );

    // ---- Stage 4: entity resolution ----
    await repo.setStage(
      runId,
      "resolving_identities",
      `Evaluating ${stored.length} candidate records`
    );
    const inputs: ResolutionInput[] = stored.map((c) => ({
      id: c.id,
      name: c.name,
      source: c.source,
      source_url: c.source_url,
      title: c.raw_data.title as string | undefined,
      snippet: c.raw_data.snippet as string | undefined,
      raw_data: c.raw_data,
    }));
    const resolution = await resolveCandidates(name, inputs);
    for (const v of resolution.verdicts) {
      await repo.updateCandidate(v.candidateId, {
        match_score: v.score,
        match_status: v.status,
      });
    }

    const accepted = stored.filter((c) => {
      const v = resolution.verdicts.find((x) => x.candidateId === c.id);
      return v && (v.status === "high_confidence_match" || v.status === "possible_match");
    });

    // Conflict handling: only a hard stop when the high-confidence evidence
    // itself is split — a dominant accepted cluster means the LLM merely saw
    // *other* same-name people (common for public figures), which is noted
    // rather than treated as unresolvable.
    const strongAccepted = accepted.filter((c) => {
      const v = resolution.verdicts.find((x) => x.candidateId === c.id);
      return v?.status === "high_confidence_match";
    });
    if (resolution.conflicting && !(accepted.length >= 2 && strongAccepted.length >= 1)) {
      await repo.markConflicting(runId, { resolution });
      return;
    }
    if (resolution.conflicting) {
      resolution.notes =
        `${resolution.notes ?? ""} Same-name candidates were excluded; profile built from the high-confidence cluster.`.trim();
    }

    if (stored.length === 0 || accepted.length === 0) {
      const person = await repo.createPerson({
        name,
        identity_status: "unresolved",
        confidence: 0,
      });
      await repo.completeRun(runId, { person_id: person.id, resolution });
      return;
    }

    // Weighted identity confidence: top verdict scores weighted by authority.
    const topScores = resolution.verdicts
      .filter((v) => accepted.some((c) => c.id === v.candidateId))
      .map((v) => v.score)
      .sort((a, b) => b - a)
      .slice(0, 5);
    const confidence = clamp(
      topScores.reduce((s, x, i) => s + x / (i + 1), 0) /
        topScores.reduce((s, _, i) => s + 1 / (i + 1), 0)
    );

    const person = await repo.createPerson({
      name,
      identity_status: confidence >= 75 ? "resolved" : "partial",
      confidence,
    });
    for (const c of accepted) {
      await repo.updateCandidate(c.id, { person_id: person.id });
    }

    // ---- Stage 5: evidence collection & enrichment ----
    await repo.setStage(runId, "collecting_evidence", "Extracting grounded evidence");

    const evidenceRows: NewEvidence[] = accepted.map((c) =>
      candidateToEvidence({ ...c, person_id: person.id }, name)
    );
    const publications: NewPublication[] = [];
    const profiles: NewProfile[] = [];
    const researchSignals: string[] = [];

    for (const c of accepted) {
      if (c.source === "orcid") {
        const orcidId = (c.raw_data.orcid as string) ?? c.source_url.split("/").pop();
        const [record, works] = await Promise.all([
          getOrcidRecord(orcidId).catch(() => null),
          getOrcidWorks(orcidId).catch(() => []),
        ]);
        if (record) {
          for (const edu of record.educations) {
            evidenceRows.push({
              person_id: person.id,
              candidate_id: c.id,
              claim: `${name} studied at ${edu.organization}`,
              evidence_text: `ORCID record lists education at ${edu.organization}${edu.role ? ` (${edu.role})` : ""}`,
              source_name: "orcid",
              source_url: c.source_url,
              evidence_type: "education",
              confidence: 85,
            });
          }
          for (const job of record.employments) {
            evidenceRows.push({
              person_id: person.id,
              candidate_id: c.id,
              claim: `${name} is affiliated with ${job.organization}`,
              evidence_text: `ORCID record lists employment at ${job.organization}${job.role ? ` (${job.role})` : ""}`,
              source_name: "orcid",
              source_url: c.source_url,
              evidence_type: "employment",
              confidence: 85,
            });
          }
          if (record.keywords.length > 0) {
            evidenceRows.push({
              person_id: person.id,
              candidate_id: c.id,
              claim: `${name}'s research keywords: ${record.keywords.join(", ")}`,
              evidence_text: "Keywords listed on the public ORCID record",
              source_name: "orcid",
              source_url: c.source_url,
              evidence_type: "research_topic",
              confidence: 80,
            });
          }
          researchSignals.push(...record.keywords);
        }
        publications.push(...works.map((w) => ({ ...w, person_id: person.id })));
        profiles.push({
          person_id: person.id,
          platform: "orcid",
          username: orcidId,
          url: c.source_url,
          description: "Public ORCID record",
        });
      }
      if (c.source === "github") {
        const login = (c.raw_data.login as string) ?? "";
        if (login) {
          const repos = await getUserRepos(login).catch(() => []);
          publications.push(
            ...reposToEvidenceItems(repos, login).map((r) => ({
              ...r,
              person_id: person.id,
            }))
          );
          researchSignals.push(
            ...repos.flatMap((r) => r.topics ?? []).slice(0, 10)
          );
          profiles.push({
            person_id: person.id,
            platform: "github",
            username: login,
            url: c.source_url,
            description: (c.raw_data.bio as string) ?? "Public GitHub profile",
          });
          if (c.raw_data.company) {
            evidenceRows.push({
              person_id: person.id,
              candidate_id: c.id,
              claim: `${name} is affiliated with ${c.raw_data.company}`,
              evidence_text: `GitHub profile lists company "${c.raw_data.company}"`,
              source_name: "github",
              source_url: c.source_url,
              evidence_type: "employment",
              confidence: 70,
            });
          }
          if (c.raw_data.location) {
            evidenceRows.push({
              person_id: person.id,
              candidate_id: c.id,
              claim: `${name} is based in ${c.raw_data.location}`,
              evidence_text: `GitHub profile lists location "${c.raw_data.location}"`,
              source_name: "github",
              source_url: c.source_url,
              evidence_type: "location",
              confidence: 60,
            });
          }
          if (c.raw_data.bio) {
            evidenceRows.push({
              person_id: person.id,
              candidate_id: c.id,
              claim: `GitHub bio of ${name}: "${c.raw_data.bio}"`,
              evidence_text: `Public GitHub bio for ${login}`,
              source_name: "github",
              source_url: c.source_url,
              evidence_type: "other",
              confidence: 65,
            });
          }
          if (c.raw_data.blog) {
            const blog = String(c.raw_data.blog);
            if (blog.startsWith("http")) {
              profiles.push({
                person_id: person.id,
                platform: "website",
                username: null,
                url: blog,
                description: "Personal website (via GitHub profile)",
              });
            }
          }
        }
      }
      // Every accepted non-structured source becomes a public-profile link
      // (LinkedIn, Instagram, Facebook, X, Scholar, university, personal site…)
      if (c.source !== "github" && c.source !== "orcid") {
        const platform = detectPlatform(c.source_url);
        profiles.push({
          person_id: person.id,
          platform,
          username: usernameFromUrl(c.source_url),
          url: c.source_url,
          description: (c.raw_data.title as string) ?? null,
        });
      }
      if (c.source === "web_search" && c.raw_data.snippet) {
        researchSignals.push(String(c.raw_data.snippet).slice(0, 120));
      }
    }
    evidenceRows.push(...visionCluesToEvidence(visionClues, person.id));

    const storedEvidence = await repo.insertEvidence(evidenceRows);
    const storedPubs = await repo.insertPublications(publications);
    const storedProfiles = await repo.insertProfiles(profiles);

    // ---- Stage 6: summary (evidence-grounded RAG) ----
    await repo.setStage(runId, "generating_summary", "Synthesizing grounded profile");
    const llmProfile = await chatJSON<StructuredProfile>(
      PROFILE_SYNTHESIS_SYSTEM_PROMPT,
      profileSynthesisUserPrompt(
        name,
        storedEvidence.map((e) => ({
          id: e.id,
          claim: e.claim,
          evidence_text: e.evidence_text,
          source_name: e.source_name,
          evidence_type: e.evidence_type,
          confidence: e.confidence,
        }))
      ),
      // Reasoning models burn tokens on hidden thinking; leave headroom so
      // the JSON profile isn't truncated into a parse failure.
      { maxTokens: 8000 }
    );

    const profile: StructuredProfile = llmProfile
      ? sanitizeProfile(llmProfile, storedEvidence.map((e) => e.id))
      : fallbackProfile(name, {
          evidence: storedEvidence,
          publications: storedPubs,
          profiles: storedProfiles,
          researchSignals,
        });
    if (!profile.summary) {
      profile.summary = "Not verified from the available public sources.";
    }
    await repo.updatePerson(person.id, {
      summary: profile.summary,
      profile,
    });

    // ---- Stage 7: evidence graph ----
    await repo.setStage(runId, "building_graph", "Building evidence graph");
    const finalEvidence = (await repo.getResult(runId))?.evidence ?? storedEvidence;
    const graph = buildEvidenceGraph({
      personName: name,
      profile,
      evidence: finalEvidence,
      publications: storedPubs,
      profiles: storedProfiles,
    });
    await repo.saveGraph(runId, graph);
    await repo.completeRun(runId, { person_id: person.id, resolution });
  } catch (err) {
    console.error("[pipeline] run failed:", err);
    await repo.failRun(
      runId,
      err instanceof Error ? err.message : "Unexpected pipeline failure"
    );
  }
}

/** Keep only evidenceIds that actually exist — models sometimes invent them. */
function sanitizeProfile(
  profile: StructuredProfile,
  validIds: string[]
): StructuredProfile {
  const ok = new Set(validIds);
  const clean = (ids?: string[]) => (ids ?? []).filter((id) => ok.has(id));
  return {
    ...profile,
    location: profile.location ?? null,
    education: (profile.education ?? []).map((e) => ({
      ...e,
      evidenceIds: clean(e.evidenceIds),
    })),
    employment: (profile.employment ?? []).map((e) => ({
      ...e,
      evidenceIds: clean(e.evidenceIds),
    })),
    biography: (profile.biography ?? [])
      .filter((b) => b.text && b.text.length > 4)
      .slice(0, 10)
      .map((b) => ({ text: b.text, evidenceIds: clean(b.evidenceIds) })),
  };
}

/** Deterministic profile assembly when no LLM is configured. */
function fallbackProfile(
  name: string,
  data: {
    evidence: { id: string; claim: string; evidence_type: string }[];
    publications: { title: string; source: string }[];
    profiles: { platform: string }[];
    researchSignals: string[];
  }
): StructuredProfile {
  const education = data.evidence
    .filter((e) => e.evidence_type === "education")
    .map((e) => ({
      institution: e.claim.replace(/^.* studied at /, ""),
      degree: null,
      field: null,
      period: null,
      evidenceIds: [e.id],
    }));
  const employment = data.evidence
    .filter((e) => e.evidence_type === "employment")
    .map((e) => ({
      organization: e.claim.replace(/^.* is affiliated with /, ""),
      role: null,
      period: null,
      evidenceIds: [e.id],
    }));
  const locationEv = data.evidence.find((e) => e.evidence_type === "location");
  const location = locationEv
    ? locationEv.claim.replace(/^.* is based in /, "")
    : null;
  const biography = data.evidence
    .filter((e) => e.evidence_type !== "profile_link")
    .slice(0, 10)
    .map((e) => ({ text: e.claim, evidenceIds: [e.id] }));
  return {
    headline: null,
    summary:
      data.evidence.length > 0
        ? `${name} has ${data.evidence.length} evidence-backed public records across ${new Set(data.profiles.map((p) => p.platform)).size || 1} platform(s). LLM synthesis is not configured; showing extracted facts only.`
        : "Not verified from the available public sources.",
    location,
    education,
    employment,
    researchAreas: [...new Set(data.researchSignals.map((s) => s.toLowerCase()))].slice(0, 8),
    biography,
  };
}

export { sleep, tokenSimilarity };
