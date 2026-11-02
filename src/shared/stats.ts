// Generic statistics: a seeded PRNG, a paired exact test and a bootstrap CI. Used by run comparison, sampling and judging.

const UINT32_RANGE = 2 ** 32;
/** Enough resamples that the 2.5% and 97.5% percentiles are stable to about one item. */
const BOOTSTRAP_ITERATIONS = 2000;
/** A 95% interval. */
const ALPHA = 0.05;
/** Fixed, so the same runs always give the same CI. */
const BOOTSTRAP_SEED = 1;

/** Deterministic PRNG (mulberry32) so bootstrap CIs are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

/**
 * Exact two-sided McNemar test. `b` = pairs only A got right, `c` = pairs only B got right.
 * Returns the p-value of the null that both are equally likely to win a discordant pair.
 */
export function mcnemarExact(b: number, c: number): number {
  const n = b + c;
  if (n === 0) return 1;
  const k = Math.min(b, c);
  let logC = 0; // ln C(n, 0)
  let tail = 0;
  for (let i = 0; i <= k; i++) {
    if (i > 0) logC += Math.log(n - i + 1) - Math.log(i);
    tail += Math.exp(logC - n * Math.LN2);
  }
  return Math.min(1, 2 * tail);
}

/**
 * Percentile bootstrap CI of `stat` over items resampled with replacement. A resample where `stat`
 * is undefined (NaN, e.g. accuracy over a subset the resample happened to miss) is dropped rather
 * than counted as a value; if every resample is undefined, so is the CI.
 */
export function bootstrapCI<T>(items: T[], stat: (sample: T[]) => number): [number, number] {
  if (items.length === 0) return [0, 0];
  const rand = rng(BOOTSTRAP_SEED);
  const values: number[] = [];
  for (let i = 0; i < BOOTSTRAP_ITERATIONS; i++) {
    const sample = Array.from({ length: items.length }, () => items[Math.floor(rand() * items.length)]);
    const value = stat(sample);
    if (!Number.isNaN(value)) values.push(value);
  }
  if (values.length === 0) return [NaN, NaN];
  values.sort((a, b) => a - b);
  const at = (q: number) => values[Math.min(values.length - 1, Math.max(0, Math.floor(q * values.length)))];
  return [at(ALPHA / 2), at(1 - ALPHA / 2)];
}
