// The quality metrics reported for a run and compared between runs. Add a metric here and both
// the eval summary and the comparison pick it up.
import { accuracy, brier, confidentMisses, ece, logLoss } from "./metrics.ts";
import { repeatCount, type Result } from "./result.ts";

export type MetricContext = { borderline: ReadonlySet<string> };

export type RunMetric = {
  id: string;
  label: string;
  lowerIsBetter: boolean;
  compute(results: Result[], context: MetricContext): number;
};

const accuracyWhere = (keep: (id: string, context: MetricContext) => boolean) =>
  (results: Result[], context: MetricContext) => accuracy(results.filter((r) => keep(r.id, context)));

export const RUN_METRICS: readonly RunMetric[] = [
  { id: "accuracy", label: "accuracy", lowerIsBetter: false, compute: accuracy },
  { id: "accuracyClear", label: "accuracy (clear)", lowerIsBetter: false, compute: accuracyWhere((id, c) => !c.borderline.has(id)) },
  { id: "accuracyBorderline", label: "accuracy (borderline)", lowerIsBetter: false, compute: accuracyWhere((id, c) => c.borderline.has(id)) },
  { id: "logLoss", label: "log-loss", lowerIsBetter: true, compute: logLoss },
  { id: "brier", label: "Brier", lowerIsBetter: true, compute: brier },
  { id: "ece", label: "ECE", lowerIsBetter: true, compute: (results) => ece(results) },
  {
    id: "confidentMissesPerRepeat",
    label: "confident misses / repeat",
    lowerIsBetter: true,
    compute: (results) => (results.length ? confidentMisses(results) / repeatCount(results) : 0),
  },
];

export function computeMetrics(results: Result[], context: MetricContext): Record<string, number> {
  return Object.fromEntries(RUN_METRICS.map((m) => [m.id, m.compute(results, context)]));
}
