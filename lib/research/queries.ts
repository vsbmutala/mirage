import type { VisionClue } from "@/types/research";

/** Base query set for a person name. */
export function baseQueries(name: string): string[] {
  const n = `"${name}"`;
  return [
    `${n} LinkedIn`,
    `${n} researcher`,
    `${n} university`,
    `${n} publications`,
    `${n} GitHub`,
    `${n} ORCID`,
    `${n} research`,
    `${n} Instagram`,
    `${n} Facebook`,
    `${n} biography`,
    `${n} speaker profile`,
  ];
}

/**
 * Expand queries using discovered signals — organizations/topics from vision
 * clues or early candidate snippets. Keeps expansion bounded.
 */
export function expandQueries(
  name: string,
  signals: string[]
): string[] {
  const n = `"${name}"`;
  return signals
    .filter((s) => s && s.length > 2 && s.length < 80)
    .slice(0, 4)
    .map((s) => `${n} "${s}"`);
}

/** Extract expansion signals from vision clues. */
export function signalsFromVision(clues: VisionClue[]): string[] {
  const wanted = new Set(["organization", "event", "conference", "presentation_title", "url"]);
  return clues
    .filter((c) => wanted.has(c.category) && c.value && c.confidence >= 40)
    .map((c) => c.value as string);
}
