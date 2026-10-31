import { isBorderline, type Brief } from "./briefs.ts";
import { accuracy, percentile, reliabilityBins, type Bin } from "./metrics.ts";
import type { Result } from "./result.ts";
import { computeMetrics } from "./run-metrics.ts";

/** What a run was: enough to reproduce it and to refuse comparing unlike runs. */
export type RunMeta = { data: string; variant: string; repeats: number; commit: string };

export type Summary = RunMeta & {
  n: number;
  model: string;
  /** null where a metric is undefined for this run, e.g. borderline accuracy on a file with no borderline briefs. */
  metrics: Record<string, number | null>;
  perRepeatAccuracy: number[];
  latencyP50: number;
  latencyP95: number;
  costPer1000Usd: number;
  bins: Bin[];
};

export function summarize(results: Result[], briefs: Brief[], meta: RunMeta, inputPricePerMillion: number): Summary {
  const borderline = new Set(briefs.filter(isBorderline).map((b) => b.id));
  const latencies = results.map((r) => r.latencyMs);
  const meanInputTokens = results.length ? results.reduce((s, r) => s + r.inputTokens, 0) / results.length : 0;
  return {
    ...meta,
    n: briefs.length,
    model: [...new Set(results.map((r) => r.model))].join(","),
    metrics: Object.fromEntries(Object.entries(computeMetrics(results, { borderline })).map(([id, v]) => [id, Number.isNaN(v) ? null : v])),
    perRepeatAccuracy: Array.from({ length: meta.repeats }, (_, i) => accuracy(results.filter((r) => r.repeat === i))),
    latencyP50: percentile(latencies, 50),
    latencyP95: percentile(latencies, 95),
    costPer1000Usd: meanInputTokens * 1000 * (inputPricePerMillion / 1e6),
    bins: reliabilityBins(results),
  };
}
