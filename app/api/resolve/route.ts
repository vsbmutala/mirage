import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveCandidates } from "@/lib/entity-resolution";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const candidateSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().max(200),
  source: z.string().max(40),
  source_url: z.string().url().max(2000),
  title: z.string().max(500).optional(),
  snippet: z.string().max(2000).optional(),
  raw_data: z.record(z.string(), z.unknown()).default({}),
});

const bodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  candidates: z.array(candidateSchema).min(1).max(40),
});

export async function POST(req: Request) {
  const rl = rateLimit(`resolve:${clientKey(req)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }
  try {
    const { name, candidates } = bodySchema.parse(await req.json());
    const outcome = await resolveCandidates(name, candidates);
    return NextResponse.json(outcome);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    console.error("[api/resolve] failed:", err);
    return NextResponse.json(
      { error: "Entity resolution is unavailable right now." },
      { status: 502 }
    );
  }
}
