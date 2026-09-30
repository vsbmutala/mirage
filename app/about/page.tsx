import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "MPEER is a research prototype for multimodal entity resolution and evidence-grounded retrieval.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        About MPEER
      </h1>
      <div className="mt-6 space-y-5 text-[15px] leading-7 text-muted">
        <p>
          <strong className="font-medium text-foreground">MPEER</strong> —
          Multimodal Public-Profile Entity Resolution &amp; Evidence Retrieval —
          is a research prototype exploring how multimodal signals and
          evidence-grounded generation can improve automated understanding of
          public professional and academic identities.
        </p>
        <p>
          The system combines classical entity-resolution ideas (candidate
          generation, pairwise/cluster scoring, conflict detection) with modern
          multimodal LLMs (image context extraction, evidence-grounded
          synthesis) and a knowledge-graph representation of the resolved
          identity.
        </p>
        <h2 className="pt-2 text-xl font-semibold tracking-tight text-foreground">
          What it is for
        </h2>
        <p>
          Researching public figures in professional and academic contexts —
          researchers, engineers, authors — where information is already public
          and published for professional purposes. It is designed for research,
          journalism, and due-diligence workflows that value provenance.
        </p>
        <h2 className="pt-2 text-xl font-semibold tracking-tight text-foreground">
          What it is not for
        </h2>
        <p>
          MPEER is not a surveillance tool. It does not identify arbitrary
          people from facial images, does not access private or gated profiles,
          and reports uncertainty rather than forcing identity matches. Every
          factual claim carries provenance so results can be independently
          verified.
        </p>
        <h2 className="pt-2 text-xl font-semibold tracking-tight text-foreground">
          Design principle
        </h2>
        <p>
          The interface deliberately distinguishes between{" "}
          <em className="text-foreground">fact</em>,{" "}
          <em className="text-foreground">model inference</em>, and{" "}
          <em className="text-foreground">unverified</em> information. When
          evidence is missing or contradictory, the system says so.
        </p>
      </div>
    </div>
  );
}
