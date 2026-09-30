import type { Metadata } from "next";
import { ResearchMethodology } from "@/components/ResearchMethodology";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How MPEER resolves public-profile entities and grounds generated profiles in source-level evidence.",
};

export default function MethodologyPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Methodology
        </h1>
        <p className="mt-4 text-base leading-7 text-muted">
          MPEER treats identity resolution as an evidence problem. Rather than
          answering &ldquo;who is this person&rdquo; directly, the system collects
          candidate public records, evaluates whether they plausibly refer to
          the same entity, and only synthesizes claims that are backed by
          stored evidence.
        </p>
      </div>
      <div className="mt-12">
        <ResearchMethodology />
      </div>

      <div className="mt-14 max-w-2xl space-y-4 text-sm leading-7 text-muted">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Confidence, not certainty
        </h2>
        <p>
          The evidence-confidence score shown on each result aggregates source
          corroboration — name overlap, cross-referenced organizations,
          structured records (ORCID, GitHub), and explicit links between
          sources. It is a heuristic signal about the strength of evidence, not
          a probability that the profile is correct.
        </p>
        <h2 className="pt-2 text-xl font-semibold tracking-tight text-foreground">
          Responsible scope
        </h2>
        <p>
          Image inputs are limited to files provided by the user and are used
          only to extract contextual text (organizations, events, URLs). MPEER
          does not perform facial recognition against arbitrary people, does
          not bypass access controls, and does not collect private information.
        </p>
      </div>
    </div>
  );
}
