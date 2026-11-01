// The eval numbers the demo shows next to a live route: the latest saved run per brief set.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Result } from "../evaluation/result.ts";
import type { Summary } from "../evaluation/summary.ts";
import { recommend } from "../routing/recommendation.ts";

/** What the pick-or-compare rule did over a run: how often it picked alone, and how often the label was where the user would look. */
export type Outcomes = {
  picked: number;
  pickedRight: number;
  compared: number;
  /** Compared routes whose label was one of the two shown. */
  comparedInShortlist: number;
};

export type Evidence = Pick<Summary, "data" | "variant" | "n" | "repeats" | "model" | "metrics" | "latencyP50" | "latencyP95" | "costPer1000Usd" | "bins"> & {
  outcomes: Outcomes;
};

type RunFile = { summary: Summary; results: Result[] };

/**
 * For each data file, the newest run of `variant` in `dir`. Run files are named by ISO timestamp, so
 * name order is time order. Files that aren't current run summaries are ignored, not fatal: the demo
 * should still start on a fresh clone with no runs.
 */
export async function loadEvidence(dir: string, variant: string): Promise<Evidence[]> {
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith(`-${variant}.json`)).sort().reverse();
  const latest = new Map<string, Evidence>();
  for (const file of files) {
    const run = await readRun(join(dir, file));
    if (run && !latest.has(run.summary.data)) latest.set(run.summary.data, pick(run));
  }
  return [...latest.values()].sort((a, b) => a.data.localeCompare(b.data));
}

async function readRun(file: string): Promise<RunFile | undefined> {
  try {
    const { summary, results } = JSON.parse(await readFile(file, "utf8")) as Partial<RunFile>;
    return summary?.metrics && summary.bins && Array.isArray(results) ? { summary, results } : undefined;
  } catch {
    return undefined;
  }
}

/** Applies the same rule the UI uses, so the page reports what a user of this router would have seen. */
export function outcomes(results: Pick<Result, "expected" | "choice" | "confidence" | "probabilities">[]): Outcomes {
  const out: Outcomes = { picked: 0, pickedRight: 0, compared: 0, comparedInShortlist: 0 };
  for (const r of results) {
    const { mode, shortlist } = recommend(r);
    if (mode === "pick") {
      out.picked++;
      if (r.choice === r.expected) out.pickedRight++;
    } else {
      out.compared++;
      if (shortlist.includes(r.expected)) out.comparedInShortlist++;
    }
  }
  return out;
}

const pick = ({ summary: s, results }: RunFile): Evidence => ({
  data: s.data, variant: s.variant, n: s.n, repeats: s.repeats, model: s.model, metrics: s.metrics,
  latencyP50: s.latencyP50, latencyP95: s.latencyP95, costPer1000Usd: s.costPer1000Usd, bins: s.bins,
  outcomes: outcomes(results),
});
