"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, Loader2, Search, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import { ImageUploader } from "./ImageUploader";
import type { VisionExtraction } from "@/types/research";

const schema = z.object({
  name: z.string().trim().min(2, "Enter a full name").max(120),
});
type FormValues = z.infer<typeof schema>;

const CLUE_LABELS: Record<string, string> = {
  visible_text: "Visible text",
  organization: "Organization text",
  logo: "Logo",
  event: "Event text",
  presentation_title: "Presentation context",
  url: "Visible website",
  conference: "Conference info",
  context: "Context clue",
  image_type: "Image type",
  other: "Other clue",
};

export function SearchInput() {
  const router = useRouter();
  const [vision, setVision] = useState<VisionExtraction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const startResearch = async (payload: Record<string, unknown>) => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not start research.");
      router.push(`/research/${json.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start research.");
      setSubmitting(false);
    }
  };

  const onSubmit = (values: FormValues) =>
    startResearch({ name: values.name, visionClues: vision?.clues ?? [] });

  const clueCategories = vision
    ? [...new Set(vision.clues.filter((c) => c.value).map((c) => c.category))]
    : [];

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="rounded-xl border border-border bg-card p-2 shadow-[0_2px_8px_rgba(16,24,40,0.06)] transition-shadow focus-within:shadow-[0_4px_16px_rgba(59,79,216,0.10)] focus-within:border-accent/40">
          <div className="flex items-center gap-2">
            <Search className="ml-3 h-4.5 w-4.5 shrink-0 text-muted" aria-hidden />
            <input
              {...register("name")}
              type="text"
              autoComplete="off"
              placeholder="Search by full name — e.g. Andrew Ng"
              aria-label="Search by full name"
              aria-invalid={Boolean(errors.name)}
              className="h-12 w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted/70"
            />
            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="shrink-0 px-5"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Research <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
        {errors.name && (
          <p className="mt-2 text-xs text-danger" role="alert">
            {errors.name.message}
          </p>
        )}
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-muted" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="font-medium tracking-wide">OR</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <ImageUploader
        onExtracted={(ex) => setVision(ex)}
        onCleared={() => setVision(null)}
      />

      {vision && clueCategories.length > 0 && (
        <div className="mt-3 rounded-lg border border-border bg-card px-4 py-3 anim-fade-up">
          <p className="text-xs font-medium text-foreground">
            Extracted contextual clues
          </p>
          <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {clueCategories.map((c) => (
              <li key={c} className="flex items-center gap-1.5 text-xs text-muted">
                <Check className="h-3 w-3 text-success" />
                {CLUE_LABELS[c] ?? c}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <p className="flex items-start gap-1.5 text-xs leading-5 text-muted" id="image-upload-note">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
          Only use images you are authorized to analyze. MPEER does not perform
          arbitrary facial identification.
        </p>
        <button
          type="button"
          disabled={submitting}
          onClick={() => startResearch({ demoId: "andrew-ng" })}
          className="shrink-0 text-sm font-medium text-accent transition-colors hover:text-accent/80"
        >
          Try an example →
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-danger/30 bg-[#fdeaec] px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
