import { SearchInput } from "./SearchInput";

export function SearchHero() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pt-20 pb-16 text-center sm:pt-28 sm:pb-20">
      <span className="anim-fade-up inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        Research prototype
      </span>
      <h1 className="anim-fade-up mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl" style={{ animationDelay: "60ms" }}>
        Multimodal intelligence for public-profile research.
      </h1>
      <p
        className="anim-fade-up mt-5 max-w-xl text-balance text-base leading-7 text-muted sm:text-lg"
        style={{ animationDelay: "120ms" }}
      >
        Resolve publicly available professional and academic information across
        heterogeneous sources using AI, multimodal reasoning, and
        evidence-backed retrieval.
      </p>
      <div className="anim-fade-up mt-10 w-full" style={{ animationDelay: "180ms" }}>
        <SearchInput />
      </div>
    </section>
  );
}
