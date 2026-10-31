// Paired statistics for comparing two eval runs on the same briefs.

/** Deterministic PRNG (mulberry32) so bootstrap CIs are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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

/** Percentile bootstrap CI of `stat` over items resampled with replacement. */
export function bootstrapCI<T>(
  items: T[],
  stat: (sample: T[]) => number,
  { iterations = 2000, alpha = 0.05, seed = 1 } = {},
): [number, number] {
  if (items.length === 0) return [0, 0];
  const rand = rng(seed);
  const values: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const sample = Array.from({ length: items.length }, () => items[Math.floor(rand() * items.length)]);
    values.push(stat(sample));
  }
  values.sort((a, b) => a - b);
  const at = (q: number) => values[Math.min(values.length - 1, Math.max(0, Math.floor(q * values.length)))];
  return [at(alpha / 2), at(1 - alpha / 2)];
}
