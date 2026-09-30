import { ArrowUpRight } from "lucide-react";
import { Badge } from "./ui/badge";
import { confidenceLabel } from "@/lib/evidence";
import { hostnameOf } from "@/lib/utils";

interface Props {
  sourceName: string;
  sourceUrl: string;
  description?: string | null;
  confidence?: number;
}

/** A single provenance card for a piece of evidence or a source record. */
export function SourceCard({ sourceName, sourceUrl, description, confidence }: Props) {
  const display = sourceUrl ? hostnameOf(sourceUrl) : sourceName;
  const level = confidence === undefined ? null : confidenceLabel(confidence);
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3.5 py-3 transition-colors hover:border-foreground/20">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{display}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted">
          {description || sourceName}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {level && (
          <Badge
            tone={level === "high" ? "success" : level === "medium" ? "warning" : "neutral"}
          >
            {level === "high" ? "High" : level === "medium" ? "Medium" : "Low"}
          </Badge>
        )}
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent/80"
            aria-label={`Open source ${display}`}
          >
            Open source <ArrowUpRight className="h-3 w-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
