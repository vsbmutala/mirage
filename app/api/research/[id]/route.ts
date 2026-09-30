import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Returns the run status and, once finished, the full result payload. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = rateLimit(`research-get:${clientKey(req)}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const { id } = await params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "Invalid research id." }, { status: 400 });
  }
  try {
    const result = await getRepo().getResult(id);
    if (!result) {
      return NextResponse.json({ error: "Research run not found." }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/research/:id] failed:", err);
    return NextResponse.json(
      { error: "Could not load this research run." },
      { status: 500 }
    );
  }
}
