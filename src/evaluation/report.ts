import { rankOptions } from "../routing/router.ts";
import { percent } from "../shared/format.ts";
import type { Bin } from "./metrics.ts";
import type { Result } from "./result.ts";
import { RUN_METRICS, type RunMetric } from "./run-metrics.ts";
import type { Summary } from "./summary.ts";

export function formatSummary(s: Summary, metrics: readonly RunMetric[] = RUN_METRICS): string[] {
  return [
    `${s.data}  variant=${s.variant}  n=${s.n} x${s.repeats}  model=${s.model}  commit=${s.commit}`,
    ...metrics.map((m) => `  ${m.label} ${formatValue(m, s.metrics[m.id])}`),
    `  per-repeat accuracy ${s.perRepeatAccuracy.map((x) => percent(x)).join(" / ")}`,
    `latency p50 ${Math.round(s.latencyP50)}ms  p95 ${Math.round(s.latencyP95)}ms   cost per 1,000 routes ~$${s.costPer1000Usd.toFixed(4)}`,
    "reliability (non-empty confidence bins):",
    ...s.bins.filter((b) => b.count > 0).map(formatBin),
  ];
}

const formatValue = (m: RunMetric, value: number | null | undefined) => (value == null ? "n/a" : m.format(value));

const formatBin = (b: Bin) =>
  `  [${b.lo.toFixed(1)}, ${b.hi.toFixed(1)}${b.hi === 1 ? "]" : ")"}  n=${b.count}  confidence ${b.avgConfidence.toFixed(3)}  accuracy ${b.accuracy.toFixed(3)}`;

export function formatMisses(results: Result[]): string[] {
  return results.filter((r) => r.choice !== r.expected).map((r) => {
    const [runnerUp] = rankOptions(r.probabilities).filter(([option]) => option !== r.choice);
    const expectedP = (r.probabilities[r.expected] ?? 0).toFixed(2);
    return `  miss ${r.id}#${r.repeat}: expected ${r.expected} (${expectedP}), got ${r.choice} (${r.confidence.toFixed(2)}), runner-up ${runnerUp?.[0]}`;
  });
}

export const progressMark = (r: Result) => (r.choice === r.expected ? "." : "x");
