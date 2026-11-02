// The quality metrics reported for a run and compared between runs. Add a metric here and both
// the eval summary and the comparison pick it up.
import { accuracy, brier, CONFIDENT_MISS_THRESHOLD, confidentMisses, ece, logLoss } from "./metrics.ts";
import { percent } from "../shared/format.ts";
import { repeatCount, type Result } from "./result.ts";

export type MetricContext = { borderline: ReadonlySet<string> };

export type RunMetric = {
  id: string;
  label: string;
  lowerIsBetter: boolean;
  compute(results: Result[], context: MetricContext): number;
  /** How the eval summary prints a value of this metric. */
  format(value: number): string;
};

const score = (x: number) => x.toFixed(3);
const perRepeat = (x: number) => x.toFixed(1);

/** Accuracy over a subset of briefs; NaN (undefined, not 0%) when the subset is empty. */
const accuracyWhere = (keep: (id: string, context: MetricContext) => boolean) =>
  (results: Result[], context: MetricContext) => {
    const subset = results.filter((r) => keep(r.id, context));
    return subset.length ? accuracy(subset) : NaN;
  };

export const RUN_METRICS: readonly RunMetric[] = [
  { id: "accuracy", label: "accuracy", lowerIsBetter: false, compute: accuracy, format: (x) => percent(x) },
  { id: "accuracyClear", label: "accuracy (clear)", lowerIsBetter: false, compute: accuracyWhere((id, c) => !c.borderline.has(id)), format: (x) => percent(x) },
  { id: "accuracyBorderline", label: "accuracy (borderline)", lowerIsBetter: false, compute: accuracyWhere((id, c) => c.borderline.has(id)), format: (x) => percent(x) },
  { id: "logLoss", label: "log-loss", lowerIsBetter: true, compute: logLoss, format: score },
  { id: "brier", label: "Brier", lowerIsBetter: true, compute: brier, format: score },
  { id: "ece", label: "ECE", lowerIsBetter: true, compute: ece, format: score },
  {
    id: "confidentMissesPerRepeat",
    label: `confident misses (>=${CONFIDENT_MISS_THRESHOLD}) / repeat`,
    lowerIsBetter: true,
    compute: (results) => (results.length ? confidentMisses(results) / repeatCount(results) : 0),
    format: perRepeat,
  },
];

export function computeMetrics(results: Result[], context: MetricContext): Record<string, number> {
  return Object.fromEntries(RUN_METRICS.map((m) => [m.id, m.compute(results, context)]));
}
