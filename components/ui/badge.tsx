import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
}

const tones = {
  neutral: "bg-black/[0.05] text-foreground/70",
  accent: "bg-accent-subtle text-accent",
  success: "bg-[#e6f4ed] text-success",
  warning: "bg-[#fdf1e3] text-warning",
  danger: "bg-[#fdeaec] text-danger",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
