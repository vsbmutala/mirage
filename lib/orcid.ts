import type { RawCandidate } from "@/types/candidate";
import type { NewPublication } from "@/types/publication";

const API = "https://pub.orcid.org/v3.0";

async function orcidFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface OrcidExpandedResult {
  "orcid-id"?: string;
  "given-names"?: string;
  "family-names"?: string;
  "institution-name"?: string[];
}

interface OrcidSearchResponse {
  "expanded-result"?: OrcidExpandedResult[] | null;
}

export interface OrcidRecordSummary {
  orcid: string;
  name: string;
  institutions: string[];
  url: string;
}

/** Search ORCID public registry for a name. Public API — no auth needed for reads. */
export async function searchOrcid(name: string): Promise<OrcidRecordSummary[]> {
  const q = encodeURIComponent(`given-and-family-names:"${name}"`);
  const data = await orcidFetch<OrcidSearchResponse>(
    `/expanded-search/?q=${q}&rows=8`
  );
  return (data?.["expanded-result"] ?? [])
    .filter((r): r is OrcidExpandedResult & { "orcid-id": string } =>
      Boolean(r?.["orcid-id"])
    )
    .map((r) => ({
      orcid: r["orcid-id"],
      name: [r["given-names"], r["family-names"]].filter(Boolean).join(" "),
      institutions: r["institution-name"] ?? [],
      url: `https://orcid.org/${r["orcid-id"]}`,
    }));
}

interface OrcidWorksResponse {
  group?: {
    "work-summary"?: {
      title?: { title?: { value?: string } };
      "publication-date"?: { year?: { value?: string } };
      "journal-title"?: { value?: string };
      url?: { value?: string };
      type?: string;
    }[];
  }[];
}

/** Fetch public works for an ORCID iD. */
export async function getOrcidWorks(orcid: string): Promise<NewPublication[]> {
  const data = await orcidFetch<OrcidWorksResponse>(
    `/${encodeURIComponent(orcid)}/works`
  );
  const pubs: NewPublication[] = [];
  for (const g of data?.group ?? []) {
    for (const w of g["work-summary"] ?? []) {
      const title = w.title?.title?.value;
      if (!title) continue;
      pubs.push({
        title,
        authors: [],
        year: w["publication-date"]?.year?.value
          ? Number(w["publication-date"].year.value)
          : null,
        venue: w["journal-title"]?.value ?? w.type ?? null,
        url: w.url?.value ?? `https://orcid.org/${orcid}`,
        source: "orcid",
      });
    }
  }
  return pubs.slice(0, 30);
}

interface OrcidRecordResponse {
  person?: {
    name?: {
      "given-names"?: { value?: string };
      "family-names"?: { value?: string };
    };
    keywords?: { keywords?: { content?: string }[] };
  };
  "activities-summary"?: {
    educations?: {
      "affiliation-group"?: {
        summaries?: {
          "education-summary"?: {
            organization?: { name?: string };
            "role-title"?: string;
          };
        }[];
      }[];
    };
    employments?: {
      "affiliation-group"?: {
        summaries?: {
          "employment-summary"?: {
            organization?: { name?: string };
            "role-title"?: string;
          };
        }[];
      }[];
    };
  };
}

export interface OrcidRecordDetail {
  name: string | null;
  keywords: string[];
  educations: { organization: string; role: string | null }[];
  employments: { organization: string; role: string | null }[];
}

export async function getOrcidRecord(
  orcid: string
): Promise<OrcidRecordDetail | null> {
  const data = await orcidFetch<OrcidRecordResponse>(
    `/${encodeURIComponent(orcid)}/record`
  );
  if (!data) return null;
  const pick = (
    groups:
      | {
          summaries?: {
            "education-summary"?: {
              organization?: { name?: string };
              "role-title"?: string;
            };
            "employment-summary"?: {
              organization?: { name?: string };
              "role-title"?: string;
            };
          }[];
        }[]
      | undefined,
    key: "education-summary" | "employment-summary"
  ) =>
    (groups ?? [])
      .flatMap((g) => g.summaries ?? [])
      .map((s) => {
        const sum = s[key];
        return sum?.organization?.name
          ? { organization: sum.organization.name, role: sum["role-title"] ?? null }
          : null;
      })
      .filter((x): x is { organization: string; role: string | null } => x !== null);

  return {
    name: [
      data.person?.name?.["given-names"]?.value,
      data.person?.name?.["family-names"]?.value,
    ]
      .filter(Boolean)
      .join(" ") || null,
    keywords: (data.person?.keywords?.keywords ?? [])
      .map((k) => k.content)
      .filter((k): k is string => Boolean(k)),
    educations: pick(
      data["activities-summary"]?.educations?.["affiliation-group"],
      "education-summary"
    ),
    employments: pick(
      data["activities-summary"]?.employments?.["affiliation-group"],
      "employment-summary"
    ),
  };
}

export function orcidToCandidate(r: OrcidRecordSummary): RawCandidate {
  return {
    name: r.name,
    source: "orcid",
    source_url: r.url,
    title: `ORCID: ${r.name}`,
    snippet: r.institutions.join(" · "),
    raw_data: { orcid: r.orcid, institutions: r.institutions },
  };
}
