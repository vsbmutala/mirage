export interface Publication {
  id: string;
  person_id: string | null;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  url: string | null;
  source: string;
  created_at: string;
}

export interface NewPublication {
  person_id?: string | null;
  title: string;
  authors: string[];
  year?: number | null;
  venue?: string | null;
  url?: string | null;
  source: string;
}

export interface PublicProfile {
  id: string;
  person_id: string | null;
  platform: string;
  username: string | null;
  url: string;
  description: string | null;
  created_at: string;
}

export interface NewPublicProfile {
  person_id?: string | null;
  platform: string;
  username?: string | null;
  url: string;
  description?: string | null;
}
