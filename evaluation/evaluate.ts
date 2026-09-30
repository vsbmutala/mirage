/**
 * MPEER evaluation harness.
 *
 * Computes entity-resolution metrics per evidence mode:
 *   - Precision, Recall, F1
 *   - False Match Rate (FMR)      = FP / (FP + TN)
 *   - False Non-Match Rate (FNMR) = FN / (FN + TP)
 *
 * Usage:
 *   npx tsx evaluation/evaluate.ts                     # heuristic resolver baseline
 *   npx tsx evaluation/evaluate.ts predictions.json    # evaluate stored predictions
 *
 * predictions.json format:
 *   { "pair-001": { "name_only": 0.8, "metadata": 0.9, "multimodal": 0.9 }, ... }
 * where each value is a match score in [0, 1] (>= 0.5 counts as "match").
 *
 * The harness deliberately ships with labels only — it does not fabricate
 * results. Reported numbers reflect whatever system produced the scores.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tokenSimilarity } from "../lib/utils";

type Mode = "name_only" | "metadata" | "multimodal";
const MODES: Mode[] = ["name_only", "metadata", "multimodal"];

interface BenchmarkCandidate {
  name: string;
  source: string;
  source_url: string;
  metadata: {
    organization?: string;
    topics?: string[];
    cross_links?: string[];
  };
  image_context?: string[];
}

interface BenchmarkPair {
  id: string;
  query_name: string;
  modes: Mode[];
  candidate: BenchmarkCandidate;
  ground_truth: "same_person" | "different_person";
}

export interface ConfusionCounts {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export interface ModeMetrics extends ConfusionCounts {
  precision: number;
  recall: number;
  f1: number;
  fmr: number;
  fnmr: number;
}

export function computeMetrics(c: ConfusionCounts): ModeMetrics {
  const precision = c.tp + c.fp ? c.tp / (c.tp + c.fp) : 0;
  const recall = c.tp + c.fn ? c.tp / (c.tp + c.fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const fmr = c.fp + c.tn ? c.fp / (c.fp + c.tn) : 0;
  const fnmr = c.fn + c.tp ? c.fn / (c.fn + c.tp) : 0;
  return { ...c, precision, recall, f1, fmr, fnmr };
}

export function evaluate(
  pairs: BenchmarkPair[],
  scoreFor: (pair: BenchmarkPair, mode: Mode) => number
): Record<Mode, ModeMetrics> {
  const counts: Record<Mode, ConfusionCounts> = {
    name_only: { tp: 0, fp: 0, tn: 0, fn: 0 },
    metadata: { tp: 0, fp: 0, tn: 0, fn: 0 },
    multimodal: { tp: 0, fp: 0, tn: 0, fn: 0 },
  };
  for (const pair of pairs) {
    const isMatch = pair.ground_truth === "same_person";
    for (const mode of pair.modes) {
      const predicted = scoreFor(pair, mode) >= 0.5;
      const c = counts[mode];
      if (predicted && isMatch) c.tp++;
      else if (predicted && !isMatch) c.fp++;
      else if (!predicted && !isMatch) c.tn++;
      else c.fn++;
    }
  }
  return {
    name_only: computeMetrics(counts.name_only),
    metadata: computeMetrics(counts.metadata),
    multimodal: computeMetrics(counts.multimodal),
  };
}

/** Baseline scorer: deterministic heuristic over the fields each mode exposes. */
export function heuristicScore(pair: BenchmarkPair, mode: Mode): number {
  const { candidate } = pair;
  let score = tokenSimilarity(pair.query_name, candidate.name) * 0.55;

  if (mode !== "name_only") {
    const md = candidate.metadata ?? {};
    if (md.cross_links && md.cross_links.length > 0) score += 0.25;
    if (md.organization) score += 0.1;
    const topics = md.topics ?? [];
    if (
      topics.some((t) =>
        ["machine learning", "deep learning", "computer vision", "artificial intelligence"].includes(t)
      )
    ) {
      score += 0.1;
    }
  }

  if (mode === "multimodal" && candidate.image_context?.length) {
    const org = candidate.metadata?.organization?.toLowerCase() ?? "";
    const aligned = candidate.image_context.some(
      (c) => org && c.toLowerCase().includes(org.split(" ")[0])
    );
    if (aligned) score += 0.1;
  }
  return Math.min(1, score);
}

/* ---------------------------------- CLI --------------------------------- */

function main() {
  const benchPath = join(__dirname, "benchmark.json");
  const bench = JSON.parse(readFileSync(benchPath, "utf8")) as {
    pairs: BenchmarkPair[];
  };

  const predictionsPath = process.argv[2];
  let predictions: Record<string, Partial<Record<Mode, number>>> | null = null;
  if (predictionsPath) {
    predictions = JSON.parse(readFileSync(predictionsPath, "utf8"));
  }

  const metrics = evaluate(bench.pairs, (pair, mode) =>
    predictions?.[pair.id]?.[mode] ?? heuristicScore(pair, mode)
  );

  const fmt = (n: number) => (n * 100).toFixed(1).padStart(6) + "%";
  console.log("\nMPEER entity-resolution evaluation");
  console.log(predictionsPath ? `predictions: ${predictionsPath}` : "baseline: heuristic scorer");
  console.log("");
  console.log(
    "mode".padEnd(12),
    "precision".padStart(10),
    "recall".padStart(9),
    "f1".padStart(9),
    "fmr".padStart(9),
    "fnmr".padStart(9)
  );
  for (const mode of MODES) {
    const m = metrics[mode];
    console.log(
      mode.padEnd(12),
      fmt(m.precision),
      fmt(m.recall),
      fmt(m.f1),
      fmt(m.fmr),
      fmt(m.fnmr)
    );
  }
  console.log("");
}

if (process.argv[1]?.endsWith("evaluate.ts")) {
  main();
}
