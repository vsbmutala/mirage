import { cn } from "@/lib/utils";

interface Props {
  value: number; // 0-100 evidence-confidence score
  label?: string;
  size?: "sm" | "md";
}

function tone(value: number) {
  if (value >= 75) return { bar: "bg-success", text: "text-success" };
  if (value >= 45) return { bar: "bg-warning", text: "text-warning" };
  return { bar: "bg-muted", text: "text-muted" };
}

/**
 * Evidence-confidence indicator. This is a heuristic aggregation of source
 * corroboration — NOT a factual probability of correctness.
 */
export function ConfidenceIndicator({ value, label = "Evidence confidence", size = "md" }: Props) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const t = tone(v);
  return (
    <div className={cn("inline-flex flex-col", size === "md" ? "gap-1.5" : "gap-1")}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
          {label}
        </span>
        <span className={cn("font-mono font-semibold", size === "md" ? "text-lg" : "text-sm", t.text)}>
          {v}%
        </span>
      </div>
      <div
        className={cn("w-full overflow-hidden rounded-full bg-black/[0.07]", size === "md" ? "h-1.5" : "h-1")}
        role="meter"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-700", t.bar)}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}
