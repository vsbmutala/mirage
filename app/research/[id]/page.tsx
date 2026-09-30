import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { getRepo } from "@/lib/db";
import { ResearchProgress } from "@/components/ResearchProgress";
import { ResearchResultView } from "@/components/ResearchResultView";
import { Card, CardContent } from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Research Result" };
export const dynamic = "force-dynamic";

export default async function ResearchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getRepo().getResult(id).catch(() => null);

  if (!result) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-24 text-center">
        <p className="text-base font-medium text-foreground">
          Research run not found.
        </p>
        <p className="mt-2 text-sm text-muted">
          It may have expired, or the link is incorrect.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80"
        >
          <ArrowLeft className="h-4 w-4" /> New Research
        </Link>
      </div>
    );
  }

  const { run } = result;

  if (run.status === "failed") {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-24">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-danger/70" />
            <p className="text-base font-medium text-foreground">
              We couldn&apos;t complete this research run.
            </p>
            <p className="max-w-sm text-sm leading-6 text-muted">
              {run.error ??
                "The rest of the research results are still available when they exist."}
            </p>
            <Link
              href="/"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80"
            >
              <ArrowLeft className="h-4 w-4" /> New Research
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (run.status === "running" || run.status === "pending") {
    return (
      <div className="flex flex-col items-center px-4 py-24">
        <p className="mb-8 text-sm text-muted">
          Researching <span className="font-medium text-foreground">{run.query.replace(/^demo:/, "")}</span>
        </p>
        <ResearchProgress
          runId={run.id}
          stages={run.stages}
          currentStage={run.stage}
        />
      </div>
    );
  }

  return <ResearchResultView result={result} />;
}
