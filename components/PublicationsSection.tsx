import { ArrowUpRight, BookOpen } from "lucide-react";
import { Badge } from "./ui/badge";
import type { Publication } from "@/types/publication";

export function PublicationsSection({ publications }: { publications: Publication[] }) {
  if (publications.length === 0) {
    return (
      <p className="text-sm text-muted">
        No reliable public source found for publications.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {publications.map((p) => (
        <li key={p.id} className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
          <div className="flex min-w-0 gap-3">
            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <div className="min-w-0">
              <p className="text-[15px] font-medium leading-6 text-foreground">
                {p.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">
                {[p.authors.join(", ") || null, p.venue, p.year]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge>{p.source}</Badge>
            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-xs font-medium text-accent hover:text-accent/80"
                aria-label={`Open ${p.title}`}
              >
                Open <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
