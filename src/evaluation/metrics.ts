import { PICK_THRESHOLD } from "../routing/recommendation.ts";

export type Prediction = { expected: string; choice: string; confidence: number };

export function accuracy(preds: Prediction[]): number {
  if (preds.length === 0) return 0;
  return preds.filter((p) => p.choice === p.expected).length / preds.length;
}

export type Bin = { lo: number; hi: number; count: number; avgConfidence: number; accuracy: number };

/** Ten equal-width bins: fine enough to show over-confidence, coarse enough to fill on ~100 briefs. */
const DEFAULT_BIN_COUNT = 10;

/** Reliability bins over [0,1]; the last bin includes 1.0. */
export function reliabilityBins(preds: Prediction[], nBins = DEFAULT_BIN_COUNT): Bin[] {
  const bins: Bin[] = [];
  for (let i = 0; i < nBins; i++) {
    const lo = i / nBins;
    const hi = (i + 1) / nBins;
    const inBin = preds.filter((p) => p.confidence >= lo && (i === nBins - 1 ? p.confidence <= hi : p.confidence < hi));
    const count = inBin.length;
    bins.push({
      lo,
      hi,
      count,
      avgConfidence: count ? inBin.reduce((s, p) => s + p.confidence, 0) / count : 0,
      accuracy: count ? accuracy(inBin) : 0,
    });
  }
  return bins;
}

/** ECE (Expected Calibration Error): weighted mean |accuracy - confidence| across bins. */
export function ece(preds: Prediction[], nBins = DEFAULT_BIN_COUNT): number {
  if (preds.length === 0) return 0;
  return reliabilityBins(preds, nBins).reduce(
    (sum, b) => sum + (b.count / preds.length) * Math.abs(b.accuracy - b.avgConfidence),
    0,
  );
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

export type ProbPrediction = Prediction & { probabilities: Record<string, number> };

/**
 * Jev reports probabilities to 2 decimals, so a reported 0 means < 0.005. Clip there instead of at
 * a tiny epsilon, or a single rounded-to-zero miss would dominate the mean.
 */
export const PROB_FLOOR = 0.005;

/** Log-loss (cross-entropy) of the expected label: mean -ln p(expected). Lower is better. */
export function logLoss(preds: ProbPrediction[]): number {
  if (preds.length === 0) return 0;
  return preds.reduce((s, p) => s - Math.log(Math.max(PROB_FLOOR, p.probabilities[p.expected] ?? 0)), 0) / preds.length;
}

/** Multi-class Brier score: mean over predictions of sum_k (p_k - y_k)^2. 0 is perfect, 2 is worst. */
export function brier(preds: ProbPrediction[]): number {
  if (preds.length === 0) return 0;
  return preds.reduce((s, p) => {
    const keys = new Set([...Object.keys(p.probabilities), p.expected]);
    let sum = 0;
    for (const k of keys) sum += ((p.probabilities[k] ?? 0) - (k === p.expected ? 1 : 0)) ** 2;
    return s + sum;
  }, 0) / preds.length;
}

/** Confidence at or above which a UI just picks (see `recommend`), so a miss there goes unnoticed. */
export const CONFIDENT_MISS_THRESHOLD = PICK_THRESHOLD;

/** Wrong answers given with at least `threshold` confidence: the misses a UI would not catch. */
export function confidentMisses(preds: Prediction[], threshold = CONFIDENT_MISS_THRESHOLD): number {
  return preds.filter((p) => p.choice !== p.expected && p.confidence >= threshold).length;
}
