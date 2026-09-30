import { getEnv } from "./env";
import type { RawCandidate } from "@/types/candidate";
import type { NewPublication } from "@/types/publication";

const API = "https://api.github.com";

function headers(): HeadersInit {
  const env = getEnv();
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
    "User-Agent": "mpeer-research-prototype",
  };
}

export interface GitHubUser {
  login: string;
  html_url: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  public_repos: number;
}

export interface GitHubRepo {
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  topics?: string[];
}

async function ghFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: headers(),
      signal: AbortSignal.timeout(15_000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Search GitHub users by a person's name. Uses the official search API. */
export async function searchGitHubUsers(name: string): Promise<GitHubUser[]> {
  const q = encodeURIComponent(`${name} in:name,fullname`);
  const data = await ghFetch<{ items?: { login: string }[] }>(
    `/search/users?q=${q}&per_page=5`
  );
  const logins = (data?.items ?? []).map((i) => i.login).slice(0, 5);
  const users = await Promise.all(
    logins.map((login) => ghFetch<GitHubUser>(`/users/${login}`))
  );
  return users.filter((u): u is GitHubUser => u !== null);
}

export async function getUserRepos(login: string): Promise<GitHubRepo[]> {
  const repos = await ghFetch<GitHubRepo[]>(
    `/users/${encodeURIComponent(login)}/repos?per_page=30&sort=updated`
  );
  return repos ?? [];
}

export function gitHubUserToCandidate(user: GitHubUser): RawCandidate {
  return {
    name: user.name ?? user.login,
    source: "github",
    source_url: user.html_url,
    title: `GitHub: ${user.login}`,
    snippet: [user.bio, user.company, user.location].filter(Boolean).join(" · "),
    raw_data: {
      login: user.login,
      bio: user.bio,
      company: user.company,
      blog: user.blog,
      location: user.location,
      public_repos: user.public_repos,
    },
  };
}

/** Derive "publication-like" notable repos as project artifacts. */
export function reposToEvidenceItems(
  repos: GitHubRepo[],
  login: string
): NewPublication[] {
  return repos
    .filter((r) => r.stargazers_count > 0 || r.description)
    .slice(0, 10)
    .map((r) => ({
      title: r.name,
      authors: [login],
      year: null,
      venue: r.language ?? null,
      url: r.html_url,
      source: "github",
    }));
}
