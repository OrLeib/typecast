export type Prediction = { expected: string; choice: string; confidence: number };

export function accuracy(preds: Prediction[]): number {
  if (preds.length === 0) return 0;
  return preds.filter((p) => p.choice === p.expected).length / preds.length;
}

export type Bin = { lo: number; hi: number; count: number; avgConfidence: number; accuracy: number };

/** Reliability bins over [0,1]; the last bin includes 1.0. */
export function reliabilityBins(preds: Prediction[], nBins = 10): Bin[] {
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
export function ece(preds: Prediction[], nBins = 10): number {
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
