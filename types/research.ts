import type { Candidate } from "./candidate";
import type { Evidence, EvidenceGraph } from "./evidence";
import type { Person, StructuredProfile } from "./person";
import type { Publication, PublicProfile } from "./publication";

export type RunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "conflicting";

export type InputType = "name" | "image" | "name+image" | "demo";

export type PipelineStage =
  | "processing_input"
  | "generating_queries"
  | "searching_sources"
  | "resolving_identities"
  | "collecting_evidence"
  | "building_graph"
  | "generating_summary"
  | "completed";

export const PIPELINE_STAGES: PipelineStage[] = [
  "processing_input",
  "generating_queries",
  "searching_sources",
  "resolving_identities",
  "collecting_evidence",
  "building_graph",
  "generating_summary",
];

export interface StageInfo {
  stage: PipelineStage;
  status: "pending" | "active" | "done" | "failed";
  detail?: string;
  completedAt?: string;
}

export interface ResearchRun {
  id: string;
  query: string;
  input_type: InputType;
  status: RunStatus;
  stage: PipelineStage;
  stages: StageInfo[];
  error: string | null;
  started_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
}

export interface VisionClue {
  category:
    | "visible_text"
    | "organization"
    | "logo"
    | "event"
    | "presentation_title"
    | "url"
    | "conference"
    | "context"
    | "image_type"
    | "other";
  value: string | null;
  evidence: string;
  confidence: number;
}

export interface VisionExtraction {
  image_type: string | null;
  clues: VisionClue[];
}

/** Full result payload returned by GET /api/research/[id]. */
export interface ResearchResult {
  run: ResearchRun;
  person: Person | null;
  profile: StructuredProfile | null;
  candidates: Candidate[];
  evidence: Evidence[];
  publications: Publication[];
  profiles: PublicProfile[];
  graph: EvidenceGraph;
}
