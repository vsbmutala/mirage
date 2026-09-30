import { getOpenAI } from "./openai";

/**
 * Text embeddings via OpenAI text-embedding-3-small. Used for optional
 * similarity scoring of candidate snippets vs the query context.
 * Returns null when OpenAI isn't configured so callers can fall back to
 * token-overlap similarity.
 */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const openai = getOpenAI();
  if (!openai || texts.length === 0) return null;
  try {
    const res = await openai.embeddings.create(
      { model: "text-embedding-3-small", input: texts.slice(0, 64) },
      { timeout: 30_000 }
    );
    return res.data.map((d) => d.embedding);
  } catch (err) {
    console.error("[embeddings] failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}
