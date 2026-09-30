export type MatchStatus =
  | "pending"
  | "high_confidence_match"
  | "possible_match"
  | "uncertain"
  | "likely_different_person"
  | "rejected";

export type CandidateSource =
  | "web_search"
  | "github"
  | "orcid"
  | "google_scholar"
  | "linkedin"
  | "university"
  | "other";

export interface Candidate {
  id: string;
  person_id: string | null;
  name: string;
  source: CandidateSource;
  source_url: string;
  raw_data: Record<string, unknown>;
  match_score: number;
  match_status: MatchStatus;
  created_at: string;
}

/** A candidate as produced by a retrieval service, before persistence. */
export interface RawCandidate {
  name: string;
  source: CandidateSource;
  source_url: string;
  title?: string;
  snippet?: string;
  raw_data: Record<string, unknown>;
}

export interface ResolutionVerdict {
  candidateId: string;
  status: MatchStatus;
  score: number;
  supporting: string[];
  contradictory: string[];
  missing: string[];
}
