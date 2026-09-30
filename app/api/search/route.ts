import { NextResponse } from "next/server";
import { z } from "zod";
import { getSearchProvider } from "@/lib/search";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  query: z.string().trim().min(2).max(300),
  maxResults: z.number().int().min(1).max(20).optional(),
});

export async function POST(req: Request) {
  const rl = rateLimit(`search:${clientKey(req)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }
  try {
    const { query, maxResults } = bodySchema.parse(await req.json());
    const results = await getSearchProvider().search(query, maxResults ?? 8);
    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid query." }, { status: 400 });
    }
    console.error("[api/search] failed:", err);
    return NextResponse.json(
      { error: "The search provider is unavailable right now." },
      { status: 502 }
    );
  }
}
