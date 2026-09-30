import { SourceCard } from "./SourceCard";
import { platformLabel } from "@/lib/utils";
import type { PublicProfile } from "@/types/publication";

export function ProfilesSection({ profiles }: { profiles: PublicProfile[] }) {
  if (profiles.length === 0) {
    return (
      <p className="text-sm text-muted">
        No public profiles were verified from the available sources.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {profiles.map((p) => (
        <SourceCard
          key={p.id}
          sourceName={platformLabel(p.platform)}
          sourceUrl={p.url}
          description={p.description ?? (p.username ? `@${p.username}` : p.platform)}
        />
      ))}
    </div>
  );
}
