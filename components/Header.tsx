import Link from "next/link";
import { ScanSearch } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-foreground transition-opacity hover:opacity-80"
          aria-label="MPEER home"
        >
          <ScanSearch className="h-5 w-5 text-accent" strokeWidth={2} />
          <span className="text-[15px] font-semibold tracking-[0.18em]">MPEER</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm text-muted" aria-label="Primary">
          <Link
            href="/methodology"
            className="rounded-md px-3 py-1.5 transition-colors hover:bg-black/[0.04] hover:text-foreground"
          >
            Methodology
          </Link>
          <Link
            href="/about"
            className="rounded-md px-3 py-1.5 transition-colors hover:bg-black/[0.04] hover:text-foreground"
          >
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}
