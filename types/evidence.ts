export type EvidenceType =
  | "affiliation"
  | "education"
  | "employment"
  | "publication"
  | "profile_link"
  | "research_topic"
  | "website"
  | "image_context"
  | "location"
  | "other";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface Evidence {
  id: string;
  person_id: string | null;
  candidate_id: string | null;
  claim: string;
  evidence_text: string;
  source_name: string;
  source_url: string;
  evidence_type: EvidenceType;
  confidence: number;
  created_at: string;
}

export interface NewEvidence {
  person_id?: string | null;
  candidate_id?: string | null;
  claim: string;
  evidence_text: string;
  source_name: string;
  source_url: string;
  evidence_type: EvidenceType;
  confidence: number;
}

export interface GraphNode {
  id: string;
  type:
    | "person"
    | "university"
    | "organization"
    | "publication"
    | "github"
    | "orcid"
    | "website"
    | "topic";
  label: string;
  evidenceIds?: string[];
  url?: string;
}

export type EdgeRelation =
  | "AFFILIATED_WITH"
  | "AUTHORED"
  | "WORKED_AT"
  | "LINKS_TO"
  | "RESEARCHES"
  | "STUDIED_AT";

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: EdgeRelation;
}

export interface EvidenceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
