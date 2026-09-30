export type IdentityStatus =
  | "resolved"
  | "partial"
  | "conflicting"
  | "unresolved";

export interface Person {
  id: string;
  name: string;
  normalized_name: string;
  summary: string | null;
  identity_status: IdentityStatus;
  confidence: number;
  profile?: StructuredProfile | null;
  created_at: string;
  updated_at: string;
}

export interface StructuredProfile {
  headline: string | null;
  summary: string;
  education: EducationEntry[];
  employment: EmploymentEntry[];
  researchAreas: string[];
  location?: string | null;
  /** Grounded one-line facts (awards, notable work, bio details). */
  biography?: BioFact[];
}

export interface BioFact {
  text: string;
  evidenceIds: string[];
}

export interface EducationEntry {
  institution: string;
  degree: string | null;
  field: string | null;
  period: string | null;
  evidenceIds: string[];
}

export interface EmploymentEntry {
  organization: string;
  role: string | null;
  period: string | null;
  evidenceIds: string[];
}
