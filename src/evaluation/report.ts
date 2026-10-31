import type { Result } from "./result.ts";
import type { Summary } from "./summary.ts";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function formatSummary(s: Summary): string[] {
  const m = s.metrics;
  return [
    `${s.data}  variant=${s.variant}  n=${s.n} x${s.repeats}  model=${s.model}  commit=${s.commit}`,
    `accuracy ${pct(m.accuracy)} (clear ${pct(m.accuracyClear)}, borderline ${pct(m.accuracyBorderline)})  per repeat ${s.perRepeatAccuracy.map(pct).join(" / ")}`,
    `ECE ${m.ece.toFixed(3)}  log-loss ${m.logLoss.toFixed(3)}  Brier ${m.brier.toFixed(3)}  confident misses (>=0.85) ${m.confidentMissesPerRepeat.toFixed(1)} per repeat`,
    `latency p50 ${Math.round(s.latencyP50)}ms  p95 ${Math.round(s.latencyP95)}ms   cost per 1,000 routes ~$${s.costPer1000Usd.toFixed(4)}`,
  ];
}

export function formatMisses(results: Result[]): string[] {
  return results.filter((r) => r.choice !== r.expected).map((r) => {
    const [runnerUp] = Object.entries(r.probabilities).filter(([option]) => option !== r.choice).sort(([, a], [, b]) => b - a);
    const expectedP = (r.probabilities[r.expected] ?? 0).toFixed(2);
    return `  miss ${r.id}#${r.repeat}: expected ${r.expected} (${expectedP}), got ${r.choice} (${r.confidence.toFixed(2)}), runner-up ${runnerUp?.[0]}`;
  });
}

export const progressMark = (r: Result) => (r.choice === r.expected ? "." : "x");
