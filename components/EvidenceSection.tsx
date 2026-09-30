import { ArrowUpRight } from "lucide-react";
import { Badge } from "./ui/badge";
import { confidenceLabel } from "@/lib/evidence";
import { hostnameOf } from "@/lib/utils";
import type { Evidence } from "@/types/evidence";

const TONE = { high: "success", medium: "warning", low: "neutral" } as const;

/** Every claim shown with its provenance — the core evidence-first view. */
export function EvidenceSection({ evidence }: { evidence: Evidence[] }) {
  if (evidence.length === 0) {
    return (
      <p className="text-sm text-muted">No evidence records were collected.</p>
    );
  }
  return (
    <ul className="space-y-3">
      {evidence.map((e) => {
        const level = confidenceLabel(e.confidence);
        return (
          <li
            key={e.id}
            className="rounded-lg border border-border bg-card px-4 py-3.5 transition-colors hover:border-foreground/20"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[15px] font-medium leading-6 text-foreground">
                {e.claim}
              </p>
              <Badge tone={TONE[level]} className="mt-0.5 shrink-0">
                {level}
              </Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted">{e.evidence_text}</p>
            <div className="mt-2.5 flex items-center gap-2 text-xs">
              <Badge>{e.evidence_type.replace("_", " ")}</Badge>
              <span className="text-muted">
                {e.source_url ? hostnameOf(e.source_url) : e.source_name}
              </span>
              {e.source_url && (
                <a
                  href={e.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium text-accent transition-colors hover:text-accent/80"
                >
                  View source <ArrowUpRight className="h-3 w-3" />
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
