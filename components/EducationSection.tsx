import { ArrowUpRight, GraduationCap } from "lucide-react";
import type { EducationEntry } from "@/types/person";
import type { Evidence } from "@/types/evidence";

interface Props {
  entries: EducationEntry[];
  evidence: Evidence[];
}

export function EducationSection({ entries, evidence }: Props) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted">
        No reliable public source found for education history.
      </p>
    );
  }
  return (
    <ul className="space-y-4">
      {entries.map((e, i) => {
        const ev = evidence.find((x) => e.evidenceIds?.includes(x.id));
        return (
          <li key={i} className="flex gap-3">
            <GraduationCap className="mt-0.5 h-4.5 w-4.5 shrink-0 text-muted" />
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-foreground">{e.institution}</p>
              <p className="mt-0.5 text-sm text-muted">
                {[e.degree, e.field, e.period].filter(Boolean).join(" · ") || null}
              </p>
              {ev && (
                <p className="mt-1.5 text-xs text-muted">
                  Evidence: {ev.source_name}{" "}
                  {ev.source_url && (
                    <a
                      href={ev.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 font-medium text-accent hover:text-accent/80"
                    >
                      View source <ArrowUpRight className="h-3 w-3" />
                    </a>
                  )}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
