// The eval numbers the demo shows next to a live route: the latest saved run per brief set.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Summary } from "../evaluation/summary.ts";

export type Evidence = Pick<Summary, "data" | "variant" | "n" | "repeats" | "model" | "metrics" | "latencyP50" | "latencyP95" | "costPer1000Usd" | "bins">;

/**
 * For each data file, the newest run of `variant` in `dir`. Run files are named by ISO timestamp, so
 * name order is time order. Files that aren't current run summaries are ignored, not fatal: the demo
 * should still start on a fresh clone with no runs.
 */
export async function loadEvidence(dir: string, variant: string): Promise<Evidence[]> {
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith(`-${variant}.json`)).sort().reverse();
  const latest = new Map<string, Evidence>();
  for (const file of files) {
    const summary = await readSummary(join(dir, file));
    if (summary && !latest.has(summary.data)) latest.set(summary.data, pick(summary));
  }
  return [...latest.values()].sort((a, b) => a.data.localeCompare(b.data));
}

async function readSummary(file: string): Promise<Summary | undefined> {
  try {
    const { summary } = JSON.parse(await readFile(file, "utf8")) as { summary?: Summary };
    return summary?.metrics && summary.bins ? summary : undefined;
  } catch {
    return undefined;
  }
}

const pick = (s: Summary): Evidence => ({
  data: s.data, variant: s.variant, n: s.n, repeats: s.repeats, model: s.model, metrics: s.metrics,
  latencyP50: s.latencyP50, latencyP95: s.latencyP95, costPer1000Usd: s.costPer1000Usd, bins: s.bins,
});
