import { FileText, GitMerge, Layers, ScanSearch } from "lucide-react";

const steps = [
  {
    n: "01",
    icon: ScanSearch,
    title: "Multimodal Input",
    body: "Names and authorized images provide contextual signals.",
  },
  {
    n: "02",
    icon: Layers,
    title: "Candidate Retrieval",
    body: "Retrieve relevant public professional and academic sources.",
  },
  {
    n: "03",
    icon: GitMerge,
    title: "Entity Resolution",
    body: "Compare evidence across sources to determine whether records refer to the same person.",
  },
  {
    n: "04",
    icon: FileText,
    title: "Evidence-Grounded Results",
    body: "Generate summaries backed by source-level evidence.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
      <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        How MPEER works
      </h2>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <div
            key={s.n}
            className="anim-fade-up rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-[0_2px_10px_rgba(16,24,40,0.06)]"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center justify-between">
              <s.icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
              <span className="font-mono text-xs text-muted/70">{s.n}</span>
            </div>
            <h3 className="mt-4 text-[15px] font-semibold text-foreground">
              {s.title}
            </h3>
            <p className="mt-1.5 text-sm leading-6 text-muted">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
