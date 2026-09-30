import OpenAI from "openai";
import { getOpenAI } from "./openai";
import { getEnv } from "./env";
import { VISION_SYSTEM_PROMPT, VISION_USER_PROMPT } from "./prompts";
import type { VisionExtraction } from "@/types/research";

export const ALLOWED_IMAGE_TYPES = new Map<string, string>([
  ["image/jpeg", "jpeg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

export function validateImage(file: File): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { ok: false, error: "Only JPG, PNG, and WEBP images are supported." };
  }
  if (file.size === 0) return { ok: false, error: "The uploaded file is empty." };
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image exceeds the 8 MB size limit." };
  }
  return { ok: true };
}

/**
 * Extracts contextual clues from a user-authorized image.
 * Deliberately does NOT perform facial recognition or name identification —
 * it only reads observable text/context (org names, event names, URLs...).
 */
export async function extractVisionClues(
  imageBuffer: Buffer,
  mimeType: string
): Promise<VisionExtraction> {
  const openai = getOpenAI();
  if (!openai) {
    return { image_type: null, clues: [] };
  }
  const env = getEnv();
  const base64 = imageBuffer.toString("base64");
  const body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model: env.llmVisionModel,
    messages: [
      { role: "system", content: VISION_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: VISION_USER_PROMPT },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 1500,
  };
  try {
    let text: string | null | undefined;
    try {
      const res = await openai.chat.completions.create(body, { timeout: 60_000 });
      text = res.choices[0]?.message?.content;
    } catch {
      // Some providers reject response_format — retry without it.
      const { response_format: _omit, ...rest } = body;
      void _omit;
      const res = await openai.chat.completions.create(rest, { timeout: 60_000 });
      text = res.choices[0]?.message?.content;
    }
    if (!text) return { image_type: null, clues: [] };
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const parsed = JSON.parse((fenced ? fenced[1] : text).trim()) as VisionExtraction;
    return {
      image_type: parsed.image_type ?? null,
      clues: Array.isArray(parsed.clues)
        ? parsed.clues.filter((c) => c && typeof c === "object")
        : [],
    };
  } catch (err) {
    console.error("[vision] extraction failed:", err instanceof Error ? err.message : err);
    return { image_type: null, clues: [] };
  }
}
