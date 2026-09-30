import { z } from "zod";

/**
 * Environment validation. All values are optional so the app can run in a
 * degraded mode (in-memory store, heuristic matching) before credentials are
 * configured. Individual services check `has*` flags and fail gracefully.
 */
const envSchema = z.object({
  // OpenRouter is preferred; OpenAI works as a fallback. Both speak the
  // OpenAI-compatible chat-completions protocol.
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  // Model ids. For OpenRouter use vendor-prefixed ids, e.g. "openai/gpt-4o-mini".
  LLM_MODEL: z.string().min(1).optional(),
  LLM_VISION_MODEL: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).optional(),
  OPENAI_VISION_MODEL: z.string().min(1).optional(),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  SEARCH_API_KEY: z.string().min(1).optional(),
  SEARCH_API_URL: z.string().url().optional(),
  SEARCH_PROVIDER: z
    .enum(["auto", "tavily", "serper", "brave", "mock"])
    .default("auto"),

  GITHUB_TOKEN: z.string().min(1).optional(),

  ORCID_CLIENT_ID: z.string().min(1).optional(),
  ORCID_CLIENT_SECRET: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema> & {
  hasLLM: boolean;
  hasOpenAI: boolean;
  hasOpenRouter: boolean;
  llmModel: string;
  llmVisionModel: string;
  hasSupabase: boolean;
  hasSearch: boolean;
  hasGitHub: boolean;
};

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  // Treat empty values ("KEY=") as unset so partially-filled files parse.
  const raw = Object.fromEntries(
    Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[env] Invalid environment configuration:", parsed.error.flatten());
    throw new Error("Invalid environment configuration");
  }
  const e = parsed.data;
  const hasOpenRouter = Boolean(e.OPENROUTER_API_KEY);
  const hasOpenAI = Boolean(e.OPENAI_API_KEY);
  // OpenRouter model ids carry a vendor prefix ("openai/gpt-5-mini");
  // the direct OpenAI API wants the bare name ("gpt-5-mini").
  const model = (m?: string, fallback?: string) => {
    const v = m ?? fallback ?? (hasOpenRouter ? "openai/gpt-4o-mini" : "gpt-4o-mini");
    return !hasOpenRouter && v.includes("/") ? v.split("/").pop()! : v;
  };
  cached = {
    ...e,
    hasLLM: hasOpenRouter || hasOpenAI,
    hasOpenRouter,
    hasOpenAI,
    llmModel: model(e.LLM_MODEL, e.OPENAI_MODEL),
    llmVisionModel: model(e.LLM_VISION_MODEL, e.OPENAI_VISION_MODEL),
    hasSupabase: Boolean(e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY),
    hasSearch: Boolean(e.SEARCH_API_KEY && e.SEARCH_API_URL),
    hasGitHub: Boolean(e.GITHUB_TOKEN),
  };
  return cached;
}
