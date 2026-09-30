import { getEnv } from "./env";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  /** Which provider produced this result. */
  provider: string;
}

export interface SearchProvider {
  readonly name: string;
  search(query: string, maxResults?: number): Promise<SearchResult[]>;
}

/* ------------------------------ Tavily ------------------------------ */

class TavilyProvider implements SearchProvider {
  readonly name = "tavily";
  constructor(
    private apiKey: string,
    private baseUrl: string
  ) {}

  async search(query: string, maxResults = 8): Promise<SearchResult[]> {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        max_results: maxResults,
        include_answer: false,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Tavily search failed (${res.status})`);
    const json = (await res.json()) as {
      results?: { title?: string; url?: string; content?: string }[];
    };
    return (json.results ?? [])
      .filter((r) => r.url)
      .map((r) => ({
        title: r.title ?? "",
        url: r.url!,
        snippet: r.content ?? "",
        provider: this.name,
      }));
  }
}

/* ------------------------------ Serper ------------------------------ */

class SerperProvider implements SearchProvider {
  readonly name = "serper";
  constructor(
    private apiKey: string,
    private baseUrl: string
  ) {}

  async search(query: string, maxResults = 8): Promise<SearchResult[]> {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": this.apiKey,
      },
      body: JSON.stringify({ q: query, num: maxResults }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Serper search failed (${res.status})`);
    const json = (await res.json()) as {
      organic?: { title?: string; link?: string; snippet?: string }[];
    };
    return (json.organic ?? [])
      .filter((r) => r.link)
      .map((r) => ({
        title: r.title ?? "",
        url: r.link!,
        snippet: r.snippet ?? "",
        provider: this.name,
      }));
  }
}

/* ------------------------------- Brave ------------------------------- */

class BraveProvider implements SearchProvider {
  readonly name = "brave";
  constructor(
    private apiKey: string,
    private baseUrl: string
  ) {}

  async search(query: string, maxResults = 8): Promise<SearchResult[]> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(maxResults));
    const res = await fetch(url, {
      headers: { "X-Subscription-Token": this.apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Brave search failed (${res.status})`);
    const json = (await res.json()) as {
      web?: { results?: { title?: string; url?: string; description?: string }[] };
    };
    return (json.web?.results ?? [])
      .filter((r) => r.url)
      .map((r) => ({
        title: r.title ?? "",
        url: r.url!,
        snippet: r.description ?? "",
        provider: this.name,
      }));
  }
}

/* ---------------------------- DuckDuckGo ------------------------------ */
/**
 * Key-free fallback: parses the lightweight DuckDuckGo HTML endpoint. This is
 * intentionally a *fallback* — configure a real SEARCH_API_* provider for
 * anything serious, since HTML parsing can break and endpoints rate-limit.
 */
class DuckDuckGoEngine {
  readonly name = "duckduckgo";

  async search(query: string, maxResults = 8): Promise<SearchResult[]> {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`DuckDuckGo search failed (${res.status})`);
    const html = await res.text();
    if (html.includes("anomaly-modal") || html.includes("challenge-form")) {
      throw new Error("DuckDuckGo rate-limited (captcha challenge)");
    }
    return parseDuckDuckGoHtml(html).slice(0, maxResults);
  }
}

/* ------------------------------- Bing -------------------------------- */
/** Second key-free engine — different HTML surface, different rate limits. */
class BingEngine {
  readonly name = "bing";

  async search(query: string, maxResults = 8): Promise<SearchResult[]> {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Bing search failed (${res.status})`);
    const html = await res.text();
    return parseBingHtml(html).slice(0, maxResults);
  }
}

/**
 * Key-free provider used when no SEARCH_API_KEY is configured. Serializes
 * upstream requests (free HTML endpoints rate-limit bursts), caches per-query
 * results for 30 minutes, and fails over between engines when one is blocked.
 */
class WebFallbackProvider implements SearchProvider {
  readonly name = "web-fallback";
  private engines = [new DuckDuckGoEngine(), new BingEngine()];
  private queue: Promise<void> = Promise.resolve();
  private lastFetchAt = 0;
  private cache = new Map<string, { at: number; results: SearchResult[] }>();
  private circuitOpen = new Map<string, number>();
  private static TTL_MS = 30 * 60 * 1000;
  private static MIN_INTERVAL_MS = 800;
  private static CIRCUIT_MS = 5 * 60 * 1000;

  async search(query: string, maxResults = 8): Promise<SearchResult[]> {
    const cached = this.cache.get(query);
    if (cached && Date.now() - cached.at < WebFallbackProvider.TTL_MS) {
      return cached.results.slice(0, maxResults);
    }
    const results = await this.enqueue(() => this.fetch(query, maxResults));
    this.cache.set(query, { at: Date.now(), results });
    return results;
  }

  /** Serializes calls and keeps ≥MIN_INTERVAL between upstream requests. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = WebFallbackProvider.MIN_INTERVAL_MS - (Date.now() - this.lastFetchAt);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastFetchAt = Date.now();
      return task();
    });
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }

  private async fetch(query: string, maxResults: number): Promise<SearchResult[]> {
    const seen = new Set<string>();
    const out: SearchResult[] = [];
    for (const engine of this.engines) {
      const openedAt = this.circuitOpen.get(engine.name);
      if (openedAt && Date.now() - openedAt < WebFallbackProvider.CIRCUIT_MS) {
        continue; // recently blocked — skip for CIRCUIT_MS
      }
      try {
        const hits = await engine.search(query, maxResults);
        for (const r of hits) {
          if (seen.has(r.url)) continue;
          seen.add(r.url);
          out.push(r);
        }
      } catch {
        this.circuitOpen.set(engine.name, Date.now());
        continue;
      }
      if (out.length >= maxResults) break;
    }
    return out.slice(0, maxResults);
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).trim();
}

/** Extract organic results from html.duckduckgo.com markup. */
function parseDuckDuckGoHtml(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const linkRe =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe =
    /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<td[^>]+class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g;

  const links: { url: string; title: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html))) {
    let href = decodeEntities(m[1]);
    // DDG wraps targets in /l/?uddg=<encoded url>
    const uddg = href.match(/[?&]uddg=([^&]+)/);
    if (uddg) href = decodeURIComponent(uddg[1]);
    if (!href.startsWith("http")) continue;
    links.push({ url: href, title: stripTags(m[2]) });
  }

  const snippets: string[] = [];
  while ((m = snippetRe.exec(html))) {
    snippets.push(stripTags(m[1] ?? m[2] ?? ""));
  }

  links.forEach((l, i) => {
    results.push({ title: l.title, url: l.url, snippet: snippets[i] ?? "", provider: "duckduckgo" });
  });
  return results;
}

/** Extract organic results from bing.com/search markup (li.b_algo blocks). */
function parseBingHtml(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const blockRe = /<li[^>]+class="b_algo"[^>]*>([\s\S]*?)<\/li>/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html))) {
    const block = m[1];
    const link = block.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!link) continue;
    let url = decodeEntities(link[1]);
    // Bing wraps organic links in /ck/a redirects; the target is in u=a1<base64url>
    const ck = url.match(/[?&]u=a1([^&]+)/);
    if (ck) {
      try {
        url = Buffer.from(ck[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
      } catch {
        continue;
      }
    }
    if (!url.startsWith("http")) continue;
    const cap = block.match(/<(?:p|div)[^>]+class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div)>|<p[^>]*>([\s\S]*?)<\/p>/);
    results.push({
      title: stripTags(link[2]),
      url,
      snippet: stripTags(cap?.[1] ?? cap?.[2] ?? ""),
      provider: "bing",
    });
  }
  return results;
}

/* ------------------------------- Mock -------------------------------- */
/** Deterministic offline provider — returns clearly-labelled empty results. */
class MockProvider implements SearchProvider {
  readonly name = "mock";
  async search(): Promise<SearchResult[]> {
    return [];
  }
}

/* ------------------------------ Selector ------------------------------ */

let provider: SearchProvider | null = null;

function detectProvider(): "tavily" | "serper" | "brave" {
  const env = getEnv();
  if (env.SEARCH_PROVIDER !== "auto" && env.SEARCH_PROVIDER !== "mock")
    return env.SEARCH_PROVIDER;
  const url = env.SEARCH_API_URL ?? "";
  if (url.includes("tavily")) return "tavily";
  if (url.includes("serper")) return "serper";
  if (url.includes("brave")) return "brave";
  return "tavily"; // default request shape
}

export function getSearchProvider(): SearchProvider {
  if (provider) return provider;
  const env = getEnv();
  if (env.SEARCH_PROVIDER === "mock") {
    provider = new MockProvider();
    return provider;
  }
  if (!env.hasSearch) {
    // No key configured — fall back to key-free web engines (DDG + Bing with
    // failover, serialization, and caching) so retrieval works out of the box.
    provider = new WebFallbackProvider();
    return provider;
  }
  const kind = detectProvider();
  const key = env.SEARCH_API_KEY!;
  const url = env.SEARCH_API_URL!;
  provider =
    kind === "serper"
      ? new SerperProvider(key, url)
      : kind === "brave"
        ? new BraveProvider(key, url)
        : new TavilyProvider(key, url);
  return provider;
}
