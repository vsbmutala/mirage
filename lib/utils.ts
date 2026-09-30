import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Token-overlap similarity in [0,1] between two names/strings. */
export function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeName(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeName(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

/**
 * What fraction of the name's tokens appear in arbitrary text. For
 * people-search, full containment means the page actually mentions the
 * queried person — a cheap junk filter for scraped results.
 */
export function nameContainment(name: string, text: string): number {
  const q = new Set(normalizeName(name).split(" ").filter(Boolean));
  if (q.size === 0) return 0;
  const t = new Set(normalizeName(text).split(" ").filter(Boolean));
  let hit = 0;
  for (const tok of q) if (t.has(tok)) hit++;
  return hit / q.size;
}

export function clamp(n: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** Map a URL to a display platform id (github, instagram, twitter, ...). */
export function detectPlatform(url: string): string {
  const h = hostnameOf(url).toLowerCase();
  if (h.includes("github.com")) return "github";
  if (h.includes("orcid.org")) return "orcid";
  if (h.includes("scholar.google")) return "google_scholar";
  if (h.includes("linkedin.com")) return "linkedin";
  if (h.includes("instagram.com")) return "instagram";
  if (h.includes("facebook.com") || h === "fb.com") return "facebook";
  if (h.includes("twitter.com") || h === "x.com" || h.endsWith(".x.com")) return "x";
  if (h.includes("youtube.com") || h === "youtu.be") return "youtube";
  if (h.includes("tiktok.com")) return "tiktok";
  if (h.includes("medium.com")) return "medium";
  if (h.includes("substack.com")) return "substack";
  if (h.includes("wikipedia.org")) return "wikipedia";
  if (h.includes("threads.net")) return "threads";
  if (h.includes("bsky.app")) return "bluesky";
  if (h.endsWith(".edu") || h.includes("ac.uk") || h.includes("edu.")) return "university";
  return "website";
}

export function platformLabel(platform: string): string {
  const labels: Record<string, string> = {
    google_scholar: "Scholar",
    x: "X / Twitter",
    bluesky: "Bluesky",
    university: "University",
    website: "Website",
  };
  return (
    labels[platform] ?? platform.charAt(0).toUpperCase() + platform.slice(1)
  );
}

/** Best-effort username/handle extraction from a social profile URL. */
export function usernameFromUrl(url: string): string | null {
  try {
    const seg = new URL(url).pathname.split("/").filter(Boolean);
    const first = seg[0];
    if (!first || ["p", "in", "status", "posts", "watch", "wiki", "profile.php"].includes(first)) {
      return first === "in" ? (seg[1] ?? null) : null;
    }
    return first.replace(/^@/, "");
  } catch {
    return null;
  }
}
