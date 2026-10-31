import { accuracy, brier, confidentMisses, ece, logLoss } from "./metrics.ts";
import type { Result } from "./runs.ts";
import { bootstrapCI, mcnemarExact } from "./stats.ts";

export type MetricRow = { metric: string; a: number; b: number; delta: number; ci: [number, number]; lowerIsBetter: boolean };

export type Flip = { id: string; expected: string; a: string; b: string };

export type Comparison = {
  n: number;
  metrics: MetricRow[];
  /** Majority-vote correctness per brief: `onlyA` = briefs only A gets right, `onlyB` = only B. */
  mcnemar: { onlyA: number; onlyB: number; p: number };
  flips: Flip[];
};

type Metric = { name: string; fn: (rs: Result[]) => number; lowerIsBetter: boolean };

/**
 * Paired comparison of two runs over the same briefs. Bootstrap resamples briefs (not individual
 * repeats), so repeated calls on one brief stay together and the CI reflects brief-level variance.
 */
export function compareRuns(a: Result[], b: Result[], borderline: Set<string>, opts: { iterations?: number; seed?: number } = {}): Comparison {
  const byId = (rs: Result[]) => {
    const m = new Map<string, Result[]>();
    for (const r of rs) m.set(r.id, [...(m.get(r.id) ?? []), r]);
    return m;
  };
  const aById = byId(a);
  const bById = byId(b);
  const ids = [...aById.keys()].filter((id) => bById.has(id)).sort();
  if (ids.length !== aById.size || ids.length !== bById.size) throw new Error("Runs cover different briefs; compare runs over the same data file");

  const repeatsOf = (rs: Result[]) => new Set(rs.map((r) => r.repeat)).size;
  const missesPerRepeat = (rs: Result[]) => (rs.length ? confidentMisses(rs) / repeatsOf(rs) : 0);
  const subset = (pick: (id: string) => boolean) => (rs: Result[]) => accuracy(rs.filter((r) => pick(r.id)));
  const metrics: Metric[] = [
    { name: "accuracy", fn: accuracy, lowerIsBetter: false },
    { name: "accuracy (clear)", fn: subset((id) => !borderline.has(id)), lowerIsBetter: false },
    { name: "accuracy (borderline)", fn: subset((id) => borderline.has(id)), lowerIsBetter: false },
    { name: "log-loss", fn: logLoss, lowerIsBetter: true },
    { name: "Brier", fn: brier, lowerIsBetter: true },
    { name: "ECE", fn: ece, lowerIsBetter: true },
    { name: "confident misses / repeat", fn: missesPerRepeat, lowerIsBetter: true },
  ];

  const gather = (m: Map<string, Result[]>, sample: string[]) => sample.flatMap((id) => m.get(id)!);
  const rows = metrics.map((m): MetricRow => {
    const av = m.fn(a);
    const bv = m.fn(b);
    const ci = bootstrapCI(ids, (sample) => m.fn(gather(bById, sample)) - m.fn(gather(aById, sample)), opts);
    return { metric: m.name, a: av, b: bv, delta: bv - av, ci, lowerIsBetter: m.lowerIsBetter };
  });

  const majority = (rs: Result[]) => {
    const counts = new Map<string, number>();
    for (const r of rs) counts.set(r.choice, (counts.get(r.choice) ?? 0) + 1);
    return [...counts.entries()].sort(([ka, x], [kb, y]) => y - x || ka.localeCompare(kb))[0][0];
  };
  let onlyA = 0;
  let onlyB = 0;
  const flips: Flip[] = [];
  for (const id of ids) {
    const expected = aById.get(id)![0].expected;
    const ca = majority(aById.get(id)!);
    const cb = majority(bById.get(id)!);
    if (ca === expected && cb !== expected) onlyA++;
    if (ca !== expected && cb === expected) onlyB++;
    if (ca !== cb) flips.push({ id, expected, a: ca, b: cb });
  }

  return { n: ids.length, metrics: rows, mcnemar: { onlyA, onlyB, p: mcnemarExact(onlyA, onlyB) }, flips };
}
