import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getRepo } from "@/lib/db";
import { runPipeline } from "@/lib/research/pipeline";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import type { VisionClue } from "@/types/research";

export const runtime = "nodejs";
export const maxDuration = 120;

const clueSchema = z.object({
  category: z.string(),
  value: z.string().nullable(),
  evidence: z.string(),
  confidence: z.number().min(0).max(100),
});

const bodySchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    demoId: z.string().trim().max(80).optional(),
    visionClues: z.array(clueSchema).max(30).optional(),
  })
  .refine((b) => b.name || b.demoId || (b.visionClues && b.visionClues.length > 0), {
    message: "Provide a name, a demoId, or vision clues.",
  });

export async function POST(req: Request) {
  const rl = rateLimit(`research:${clientKey(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    const msg =
      err instanceof z.ZodError ? err.issues[0]?.message : "Invalid request body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    const repo = getRepo();
    const inputType = body.demoId
      ? "demo"
      : body.name && body.visionClues?.length
        ? "name+image"
        : body.visionClues?.length
          ? "image"
          : "name";

    const run = await repo.createRun({
      query: body.demoId ? `demo:${body.demoId}` : body.name ?? "image-only",
      input_type: inputType,
      metadata: { resolution: null },
    });

    // Continue the pipeline after the response is sent; progress is tracked
    // by polling GET /api/research/[id].
    after(() =>
      runPipeline(run.id, {
        name: body.name,
        demoId: body.demoId,
        visionClues: body.visionClues as VisionClue[] | undefined,
      })
    );

    return NextResponse.json({ id: run.id, status: run.status }, { status: 202 });
  } catch (err) {
    console.error("[api/research] failed:", err);
    return NextResponse.json(
      { error: "Could not start the research run." },
      { status: 500 }
    );
  }
}
