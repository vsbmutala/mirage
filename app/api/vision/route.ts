import { NextResponse } from "next/server";
import { extractVisionClues, validateImage } from "@/lib/vision";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 90;

/**
 * Accepts a user-authorized image (multipart/form-data, field "file") and
 * returns extracted contextual clues. No facial recognition is performed.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`vision:${clientKey(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    file = form.get("file") as File | null;
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const validation = validateImage(file);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extraction = await extractVisionClues(buffer, file.type);
    return NextResponse.json(extraction);
  } catch (err) {
    console.error("[api/vision] failed::", err);
    return NextResponse.json(
      { error: "We couldn't analyze this image right now." },
      { status: 502 }
    );
  }
}
