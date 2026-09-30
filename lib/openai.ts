import OpenAI from "openai";
import { getEnv } from "./env";

let client: OpenAI | null = null;

/**
 * LLM client — OpenRouter when configured, OpenAI otherwise. Both speak the
 * OpenAI-compatible chat-completions protocol, so the same SDK works.
 * Returns null when no key is configured — callers must degrade.
 */
export function getOpenAI(): OpenAI | null {
  const env = getEnv();
  if (!env.hasLLM) return null;
  if (!client) {
    client = env.hasOpenRouter
      ? new OpenAI({
          apiKey: env.OPENROUTER_API_KEY,
          baseURL: env.OPENROUTER_BASE_URL,
          defaultHeaders: {
            "HTTP-Referer": "https://mpeer.local",
            "X-Title": "MPEER",
          },
        })
      : new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return client;
}

async function createChat(
  openai: OpenAI,
  body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  timeoutMs: number,
  useJsonFormat: boolean
) {
  const params = { ...body };
  if (!useJsonFormat) {
    delete (params as { response_format?: unknown }).response_format;
  }
  return openai.chat.completions.create(params, { timeout: timeoutMs });
}

/**
 * Calls a chat model expecting strict JSON back. Retries once without
 * `response_format` if the provider/model rejects it. Returns parsed JSON or
 * null on any failure (no key, timeout, malformed output).
 */
export async function chatJSON<T>(
  system: string,
  user: string,
  opts: { model?: string; timeoutMs?: number; maxTokens?: number } = {}
): Promise<T | null> {
  const openai = getOpenAI();
  if (!openai) return null;
  const env = getEnv();
  const body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model: opts.model ?? env.llmModel,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    // max_completion_tokens is the modern param; gpt-5/o-series reject the
    // legacy max_tokens. Reasoning models also reject custom temperatures,
    // so none is sent — JSON output is already forced via response_format.
    max_completion_tokens: opts.maxTokens ?? 2000,
  };
  const timeoutMs = opts.timeoutMs ?? 45_000;
  try {
    let res: OpenAI.Chat.Completions.ChatCompletion;
    try {
      res = await createChat(openai, body, timeoutMs, true);
    } catch {
      res = await createChat(openai, body, timeoutMs, false);
    }
    const text = res.choices[0]?.message?.content;
    if (!text) return null;
    return JSON.parse(stripCodeFences(text)) as T;
  } catch (err) {
    console.error("[llm] chatJSON failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

function stripCodeFences(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}
