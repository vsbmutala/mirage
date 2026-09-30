import { ArrowDown } from "lucide-react";

const PIPELINE = [
  { title: "Multimodal Input", body: "A full name and/or a user-authorized image. Images contribute contextual clues (organizations, events, URLs) — never facial identification." },
  { title: "Candidate Retrieval", body: "Query generation over permitted public sources: a pluggable search provider, the GitHub API, and the ORCID public registry." },
  { title: "Entity Resolution", body: "Candidates are scored on name similarity, organization overlap, publications, and explicit cross-links. Conflicting identity clusters are reported, not merged." },
  { title: "Evidence Extraction", body: "Every claim is backed by a source-level evidence record with provenance, type, and a confidence signal." },
  { title: "Knowledge Graph", body: "Resolved entities become nodes (person, organizations, publications, profiles) with typed relations between them." },
  { title: "Evidence-Grounded RAG", body: "The final profile is synthesized strictly from stored evidence. Unsupported facts are reported as unverified." },
];

const QUESTIONS = [
  "Can multimodal contextual information improve candidate retrieval?",
  "Can cross-source evidence reduce false identity matches?",
  "Does evidence-grounded RAG reduce unsupported claims?",
  "How does multimodal entity resolution compare with metadata-only matching?",
];

export function ResearchMethodology() {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
      <ol className="space-y-0">
        {PIPELINE.map((step, i) => (
          <li key={step.title}>
            <div className="rounded-lg border border-border bg-card px-5 py-4">
              <p className="text-sm font-semibold text-foreground">
                <span className="mr-2 font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                {step.title}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-muted">{step.body}</p>
            </div>
            {i < PIPELINE.length - 1 && (
              <div className="flex justify-center py-1.5" aria-hidden>
                <ArrowDown className="h-4 w-4 text-muted/50" />
              </div>
            )}
          </li>
        ))}
      </ol>
      <aside className="h-fit rounded-lg border border-border bg-card px-5 py-5">
        <h3 className="text-sm font-semibold text-foreground">Research Questions</h3>
        <ul className="mt-3 space-y-2.5">
          {QUESTIONS.map((q) => (
            <li key={q} className="flex gap-2 text-sm leading-6 text-muted">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
              {q}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
