"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES, type PipelineStage, type StageInfo } from "@/types/research";

const STAGE_LABELS: Record<PipelineStage, string> = {
  processing_input: "Processing input",
  generating_queries: "Generating queries",
  searching_sources: "Searching public sources",
  resolving_identities: "Resolving candidate identities",
  collecting_evidence: "Collecting evidence",
  building_graph: "Building evidence graph",
  generating_summary: "Generating summary",
  completed: "Done",
};

interface Props {
  runId: string;
  stages: StageInfo[];
  currentStage: PipelineStage;
}

/** Polls the run while it is in-flight and refreshes the page when done. */
export function ResearchProgress({ runId, stages, currentStage }: Props) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/research/${runId}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const status = json?.run?.status;
        if (
          status === "completed" ||
          status === "failed" ||
          status === "conflicting"
        ) {
          if (!done.current) {
            done.current = true;
            router.refresh();
          }
          stop = true;
        }
      } catch {
        /* transient — keep polling */
      }
    };
    const interval = setInterval(async () => {
      if (!stop) await tick();
    }, 1200);
    void tick();
    return () => {
      stop = true;
      clearInterval(interval);
    };
  }, [runId, router]);

  const activeIdx = Math.max(
    0,
    PIPELINE_STAGES.indexOf(currentStage)
  );
  const detail = stages.find((s) => s.stage === currentStage)?.detail;

  return (
    <div
      className="mx-auto w-full max-w-md rounded-xl border border-border bg-card p-6"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
        <h2 className="text-sm font-semibold text-foreground">Researching…</h2>
      </div>
      <ul className="mt-5 space-y-3">
        {PIPELINE_STAGES.map((stage, i) => {
          const state =
            i < activeIdx ? "done" : i === activeIdx ? "active" : "pending";
          const info = stages.find((s) => s.stage === stage);
          return (
            <li key={stage} className="flex items-center gap-3">
              {state === "done" ? (
                <Check className="h-4 w-4 text-success" />
              ) : state === "active" ? (
                <span className="anim-pulse-dot h-2.5 w-2.5 rounded-full bg-accent" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-border" />
              )}
              <span
                className={cn(
                  "text-sm",
                  state === "done" && "text-muted",
                  state === "active" && "font-medium text-foreground",
                  state === "pending" && "text-muted/60"
                )}
              >
                {STAGE_LABELS[stage]}
              </span>
              {state === "active" && (info?.detail ?? detail) && (
                <span className="truncate text-xs text-muted/70">
                  {info?.detail ?? detail}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
