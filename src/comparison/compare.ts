import type { Result } from "../evaluation/result.ts";
import { RUN_METRICS, type MetricContext } from "../evaluation/run-metrics.ts";
import { bootstrapCI, mcnemarExact } from "../shared/stats.ts";

export type MetricDelta = { metric: string; a: number; b: number; delta: number; ci: [number, number]; lowerIsBetter: boolean };

/** A brief whose majority choice differs between runs; undefined means that run had no majority. */
export type Flip = { id: string; expected: string; a: string | undefined; b: string | undefined };

export type Comparison = {
  n: number;
  metrics: MetricDelta[];
  /** Majority-vote correctness per brief: `onlyA` = briefs only A gets right, `onlyB` = only B. */
  mcnemar: { onlyA: number; onlyB: number; p: number };
  flips: Flip[];
};

/**
 * Paired comparison of two runs over the same briefs. Bootstrap resamples briefs (not individual
 * repeats), so repeated calls on one brief stay together and the CI reflects brief-level variance.
 */
export function compareRuns(a: Result[], b: Result[], context: MetricContext): Comparison {
  const aById = groupById(a);
  const bById = groupById(b);
  const ids = sharedIds(aById, bById);
  const gather = (byId: Map<string, Result[]>, sample: string[]) => sample.flatMap((id) => byId.get(id)!);

  const metrics = RUN_METRICS.map((m): MetricDelta => {
    const av = m.compute(a, context);
    const bv = m.compute(b, context);
    const ci = bootstrapCI(ids, (sample) => m.compute(gather(bById, sample), context) - m.compute(gather(aById, sample), context));
    return { metric: m.label, a: av, b: bv, delta: bv - av, ci, lowerIsBetter: m.lowerIsBetter };
  });

  let onlyA = 0;
  let onlyB = 0;
  const flips: Flip[] = [];
  for (const id of ids) {
    const expected = aById.get(id)![0].expected;
    const choiceA = majorityChoice(aById.get(id)!);
    const choiceB = majorityChoice(bById.get(id)!);
    if (choiceA === expected && choiceB !== expected) onlyA++;
    if (choiceA !== expected && choiceB === expected) onlyB++;
    if (choiceA !== choiceB) flips.push({ id, expected, a: choiceA, b: choiceB });
  }

  return { n: ids.length, metrics, mcnemar: { onlyA, onlyB, p: mcnemarExact(onlyA, onlyB) }, flips };
}

/** Whether a delta's whole CI lies on the improving side, the worsening side, or straddles zero. */
export function verdict(d: MetricDelta): "better" | "worse" | "unclear" {
  const [lo, hi] = d.ci;
  if (d.lowerIsBetter ? hi < 0 : lo > 0) return "better";
  if (d.lowerIsBetter ? lo > 0 : hi < 0) return "worse";
  return "unclear";
}

function groupById(results: Result[]): Map<string, Result[]> {
  const byId = new Map<string, Result[]>();
  for (const r of results) byId.set(r.id, [...(byId.get(r.id) ?? []), r]);
  return byId;
}

function sharedIds(a: Map<string, Result[]>, b: Map<string, Result[]>): string[] {
  const ids = [...a.keys()].filter((id) => b.has(id)).sort();
  if (ids.length !== a.size || ids.length !== b.size) throw new Error("Runs cover different briefs; compare runs over the same data file");
  return ids;
}

/**
 * Most frequent choice across repeats, or undefined when the top choices tie. A tie counts as
 * wrong: breaking it by option name would decide correctness by spelling.
 */
function majorityChoice(results: Result[]): string | undefined {
  const counts = new Map<string, number>();
  for (const r of results) counts.set(r.choice, (counts.get(r.choice) ?? 0) + 1);
  const [first, second] = [...counts.entries()].sort(([, x], [, y]) => y - x);
  return second && second[1] === first[1] ? undefined : first[0];
}
