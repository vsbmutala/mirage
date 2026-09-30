import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { Badge } from "./ui/badge";
import { ConfidenceIndicator } from "./ConfidenceIndicator";
import type { Person } from "@/types/person";

const STATUS_LABEL: Record<Person["identity_status"], { text: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  resolved: { text: "Identity Evidence", tone: "success" },
  partial: { text: "Partial match", tone: "warning" },
  conflicting: { text: "Conflicting candidates", tone: "danger" },
  unresolved: { text: "Unresolved", tone: "neutral" },
};

export function ProfileHeader({ person, isDemo }: { person: Person; isDemo: boolean }) {
  const status = STATUS_LABEL[person.identity_status];
  return (
    <div>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> New Research
      </Link>
      <div className="mt-6 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Research Result
          </p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {person.name}
          </h1>
          <div className="mt-3 flex items-center gap-2">
            <Badge tone={status.tone}>{status.text}</Badge>
            {isDemo && (
              <Badge tone="accent">
                <FlaskConical className="h-3 w-3" /> Demo case
              </Badge>
            )}
          </div>
        </div>
        <div className="w-full max-w-45 sm:w-48">
          <ConfidenceIndicator value={person.confidence} />
        </div>
      </div>
    </div>
  );
}
