import type { CandidateSource, MatchStatus } from "@/types/candidate";
import type { StructuredProfile } from "@/types/person";

export interface PersonRow {
  id: string;
  name: string;
  normalized_name: string;
  summary: string | null;
  identity_status: "resolved" | "partial" | "conflicting" | "unresolved";
  confidence: number;
  profile: StructuredProfile | null;
  created_at: string;
  updated_at: string;
}

export interface NewCandidateRow {
  research_run_id?: string;
  person_id?: string | null;
  name: string;
  source: CandidateSource;
  source_url: string;
  raw_data?: Record<string, unknown>;
  match_score?: number;
  match_status?: MatchStatus;
}
