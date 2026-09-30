import { ArrowUpRight } from "lucide-react";
import type { BioFact } from "@/types/person";
import type { Evidence } from "@/types/evidence";
import { hostnameOf } from "@/lib/utils";

interface Props {
  facts: BioFact[];
  evidence: Evidence[];
}

/**
 * "Full biography" card — every line is a grounded fact with provenance.
 * Facts without a linked source are labelled as model inference.
 */
export function BiographySection({ facts, evidence }: Props) {
  if (facts.length === 0) {
    return (
      <p className="text-sm text-muted">
        No reliable public source found for a biography.
      </p>
    );
  }
  return (
    <ul className="space-y-3.5">
      {facts.map((f, i) => {
        const linked = evidence.filter((e) => f.evidenceIds?.includes(e.id));
        return (
          <li key={i} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
            <div className="min-w-0">
              <p className="text-[15px] leading-6 text-foreground/90">{f.text}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                {linked.length > 0 ? (
                  linked.slice(0, 2).map((e) => (
                    <span key={e.id} className="inline-flex items-center gap-1 text-xs text-muted">
                      Evidence · {e.source_url ? hostnameOf(e.source_url) : e.source_name}
                      {e.source_url && (
                        <a
                          href={e.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 font-medium text-accent hover:text-accent/80"
                          aria-label={`View source for: ${f.text}`}
                        >
                          <ArrowUpRight className="h-3 w-3" />
                        </a>
                      )}
                    </span>
                  ))
                ) : (
                  <span className="text-xs italic text-muted/80">
                    Model inference — no linked source
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
