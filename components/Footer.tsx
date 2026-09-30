import Link from "next/link";
import { ScanSearch } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <ScanSearch className="h-4 w-4 text-accent" strokeWidth={2} />
              <span className="text-sm font-semibold tracking-[0.18em]">MPEER</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">
              Multimodal Public-Profile Entity Resolution &amp; Evidence Retrieval.
            </p>
            <p className="mt-1 text-[13px] leading-5 text-muted/80">
              Research prototype for multimodal AI, entity resolution, and
              evidence-grounded retrieval.
            </p>
          </div>
          <nav className="flex gap-8 text-sm text-muted" aria-label="Footer">
            <Link href="/methodology" className="transition-colors hover:text-foreground">
              Methodology
            </Link>
            <a
              href="https://github.com/vsbmutala/mirage"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
            <Link href="/about" className="transition-colors hover:text-foreground">
              About
            </Link>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-1 border-t border-border pt-6 text-[13px] text-muted/80 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 MPEER</span>
          <span>Built for AI research and experimentation.</span>
        </div>
      </div>
    </footer>
  );
}
