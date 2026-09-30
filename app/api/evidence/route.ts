import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepo } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  researchRunId: z.string().min(1).max(80),
});

/**
 * Returns the evidence rows attached to a research run (or its resolved
 * person). Read-only — evidence is produced by the research pipeline.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`evidence:${clientKey(req)}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }
  try {
    const { researchRunId } = bodySchema.parse(await req.json());
    const result = await getRepo().getResult(researchRunId);
    if (!result) {
      return NextResponse.json({ error: "Research run not found." }, { status: 404 });
    }
    return NextResponse.json({ evidence: result.evidence });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    console.error("[api/evidence] failed:", err);
    return NextResponse.json(
      { error: "Could not load evidence right now." },
      { status: 502 }
    );
  }
}
