"use client";

import { useState } from "react";
import { AlertTriangle, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileOverview } from "./ProfileOverview";
import { BiographySection } from "./BiographySection";
import { EducationSection } from "./EducationSection";
import { EmploymentSection } from "./EmploymentSection";
import { PublicationsSection } from "./PublicationsSection";
import { ProfilesSection } from "./ProfilesSection";
import { EvidenceSection } from "./EvidenceSection";
import { EvidenceGraph } from "./EvidenceGraph";
import { ConfidenceIndicator } from "./ConfidenceIndicator";
import type { ResearchResult } from "@/types/research";

const TABS = ["Overview", "Publications", "Profiles", "Evidence", "Graph"] as const;
type Tab = (typeof TABS)[number];

export function ResearchResultView({ result }: { result: ResearchResult }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const { run, person, profile, candidates, evidence, publications, profiles, graph } =
    result;
  const isDemo = run.input_type === "demo" || run.query.startsWith("demo:");
  const conflicting = run.status === "conflicting" || person?.identity_status === "conflicting";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      {person ? (
        <ProfileHeader person={person} isDemo={isDemo} />
      ) : (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Research Result
          </p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-foreground">
            {run.query.replace(/^demo:/, "")}
          </h1>
        </div>
      )}

      {conflicting && <ConflictingState candidates={candidates} />}
      {!person && !conflicting && <EmptyState />}

      {person && !conflicting && (
        <>
          <div className="mt-8">
            <ProfileOverview
              name={person.name}
              profile={profile}
              profiles={profiles}
              publicationCount={publications.length}
            />
          </div>

          <div className="mt-8" role="tablist" aria-label="Profile sections">
            <div className="flex gap-1 overflow-x-auto border-b border-border">
              {TABS.map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "relative -mb-px shrink-0 border-b-2 px-3.5 pb-2.5 pt-1 text-sm font-medium transition-colors",
                    tab === t
                      ? "border-accent text-foreground"
                      : "border-transparent text-muted hover:text-foreground"
                  )}
                >
                  {t}
                  {t === "Evidence" && evidence.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] text-muted">
                      {evidence.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="anim-fade-up py-6" role="tabpanel" key={tab}>
              {tab === "Overview" && (
                <div className="flex flex-col gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Biography</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <BiographySection
                        facts={profile?.biography ?? []}
                        evidence={evidence}
                      />
                    </CardContent>
                  </Card>
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Education</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <EducationSection
                          entries={profile?.education ?? []}
                          evidence={evidence}
                        />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Employment</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <EmploymentSection
                          entries={profile?.employment ?? []}
                          evidence={evidence}
                        />
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
              {tab === "Publications" && (
                <Card>
                  <CardContent className="pt-5">
                    <PublicationsSection publications={publications} />
                  </CardContent>
                </Card>
              )}
              {tab === "Profiles" && <ProfilesSection profiles={profiles} />}
              {tab === "Evidence" && <EvidenceSection evidence={evidence} />}
              {tab === "Graph" && (
                <EvidenceGraph graph={graph} evidence={evidence} />
              )}
            </div>
          </div>
        </>
      )}

      {person && conflicting && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Candidates evaluated</CardTitle>
          </CardHeader>
          <CardContent>
            <CandidateList candidates={candidates} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="mt-8">
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <SearchX className="h-8 w-8 text-muted/60" />
        <p className="text-base font-medium text-foreground">
          No reliable public information found.
        </p>
        <div className="text-sm leading-6 text-muted">
          <p>Try adding:</p>
          <ul className="mt-1 space-y-0.5">
            <li>• a middle name</li>
            <li>• an organization</li>
            <li>• a university</li>
            <li>• a research area</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function ConflictingState({ candidates }: { candidates: ResearchResult["candidates"] }) {
  return (
    <div className="mt-8 space-y-4">
      <div className="rounded-lg border border-warning/30 bg-[#fdf6ec] px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Multiple possible profiles found.
            </p>
            <p className="mt-1 text-sm leading-6 text-muted">
              We found conflicting evidence and cannot reliably determine that
              these records represent the same person. Review the candidates
              below — no identity match was forced.
            </p>
          </div>
        </div>
      </div>
      <CandidateList candidates={candidates} />
    </div>
  );
}

function CandidateList({ candidates }: { candidates: ResearchResult["candidates"] }) {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => b.match_score - a.match_score).slice(0, 15);
  return (
    <ul className="space-y-2.5">
      {sorted.map((c) => {
        const raw = c.raw_data as {
          title?: string;
          snippet?: string;
          bio?: string | null;
          company?: string | null;
          location?: string | null;
          blog?: string | null;
          institutions?: string[];
          login?: string;
        };
        const facts = [
          raw.company ? `Company: ${raw.company}` : null,
          raw.location ? `Location: ${raw.location}` : null,
          raw.institutions?.length
            ? `Institutions: ${raw.institutions.join(", ")}`
            : null,
          raw.bio ? `Bio: ${raw.bio}` : null,
          raw.blog ? `Site: ${raw.blog}` : null,
        ].filter(Boolean) as string[];
        return (
          <li
            key={c.id}
            className="rounded-lg border border-border bg-card px-4 py-3.5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {raw.title ?? c.name}
                </p>
                <a
                  href={c.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 block truncate text-xs text-accent hover:text-accent/80"
                >
                  {c.source_url}
                </a>
              </div>
              <div className="flex w-32 shrink-0 flex-col gap-1">
                <Badge
                  className="self-end"
                  tone={c.match_status === "high_confidence_match" ? "success" : c.match_status === "possible_match" ? "warning" : "neutral"}
                >
                  {c.match_status.replace(/_/g, " ")}
                </Badge>
                <ConfidenceIndicator value={c.match_score} label="match" size="sm" />
              </div>
            </div>
            {raw.snippet && (
              <p className="mt-2 text-xs leading-5 text-muted">{raw.snippet}</p>
            )}
            {facts.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {facts.map((f, i) => (
                  <li key={i} className="text-xs leading-5 text-muted">
                    {f}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] uppercase tracking-wide text-muted/60">
              Source: {c.source}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
