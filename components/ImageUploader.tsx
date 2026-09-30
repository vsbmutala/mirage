"use client";

import { useCallback, useRef, useState } from "react";
import { FileImage, Loader2, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VisionExtraction } from "@/types/research";

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

interface Props {
  onExtracted: (extraction: VisionExtraction, fileName: string) => void;
  onCleared: () => void;
}

export function ImageUploader({ onExtracted, onCleared }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!ACCEPTED.includes(file.type)) {
        setError("Only JPG, PNG, and WEBP images are supported.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("Image exceeds the 8 MB size limit.");
        return;
      }
      setBusy(true);
      setFileName(file.name);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/vision", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Image analysis failed.");
        onExtracted(json as VisionExtraction, file.name);
      } catch (e) {
        setFileName(null);
        setError(e instanceof Error ? e.message : "Image analysis failed.");
      } finally {
        setBusy(false);
      }
    },
    [onExtracted]
  );

  const clear = () => {
    setFileName(null);
    setError(null);
    onCleared();
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="sr-only"
        aria-label="Upload authorized image"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
          dragging
            ? "border-accent bg-accent-subtle"
            : "border-border bg-card hover:border-foreground/25 hover:bg-black/[0.015]",
          "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
        )}
        aria-describedby="image-upload-note"
      >
        {busy ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
            <span className="text-sm font-medium text-foreground">Analyzing image…</span>
            <span className="text-xs text-muted">{fileName}</span>
          </>
        ) : fileName ? (
          <>
            <FileImage className="h-6 w-6 text-success" />
            <span className="text-sm font-medium text-foreground">Image analyzed</span>
            <span className="text-xs text-muted">{fileName}</span>
          </>
        ) : (
          <>
            <UploadCloud className="h-6 w-6 text-muted" />
            <span className="text-sm font-medium text-foreground">
              Upload authorized image
            </span>
            <span className="text-xs text-muted">Drag &amp; drop or browse</span>
            <span className="text-[11px] uppercase tracking-wide text-muted/70">
              PNG / JPG / WEBP
            </span>
          </>
        )}
      </button>
      {fileName && !busy && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
          >
            <X className="h-3 w-3" /> Remove image
          </button>
        </div>
      )}
      {error && (
        <p className="mt-2 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
