import { NextResponse } from "next/server";
import { z } from "zod";
import { chatJSON } from "@/lib/openai";
import {
  PROFILE_SYNTHESIS_SYSTEM_PROMPT,
  profileSynthesisUserPrompt,
} from "@/lib/prompts";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import type { StructuredProfile } from "@/types/person";

export const runtime = "nodejs";

const evidenceSchema = z.object({
  id: z.string().max(80),
  claim: z.string().max(500),
  evidence_text: z.string().max(2000),
  source_name: z.string().max(200),
  evidence_type: z.string().max(40),
  confidence: z.number().min(0).max(100),
});

const bodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  evidence: z.array(evidenceSchema).min(1).max(100),
});

/**
 * Evidence-grounded profile synthesis. Returns a structured profile where
 * every factual claim maps to supplied evidence ids — or a 503 when the LLM
 * isn't configured.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`summarize:${clientKey(req)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }
  try {
    const { name, evidence } = bodySchema.parse(await req.json());
    const profile = await chatJSON<StructuredProfile>(
      PROFILE_SYNTHESIS_SYSTEM_PROMPT,
      profileSynthesisUserPrompt(name, evidence),
      { maxTokens: 1800 }
    );
    if (!profile) {
      return NextResponse.json(
        { error: "Profile synthesis requires an OpenAI key." },
        { status: 503 }
      );
    }
    return NextResponse.json({ profile });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    console.error("[api/summarize] failed:", err);
    return NextResponse.json(
      { error: "Profile synthesis is unavailable right now." },
      { status: 502 }
    );
  }
}
