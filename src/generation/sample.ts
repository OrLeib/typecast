import { rng } from "../comparison/stats.ts";
import type { Brief } from "../evaluation/briefs.ts";

export type SampleOptions = { perCategory: number; categories: readonly string[]; seed: number };

/**
 * A fixed, category-balanced sample: `perCategory` briefs per expected category, picked by a seeded
 * shuffle so the same options always give the same briefs. Returned in file order.
 */
export function selectSample(briefs: Brief[], { perCategory, categories, seed }: SampleOptions): Brief[] {
  const chosen = new Set<string>();
  for (const category of categories) {
    const pool = briefs.filter((b) => b.expected === category);
    if (pool.length < perCategory) throw new Error(`Only ${pool.length} "${category}" briefs, need ${perCategory}`);
    for (const b of shuffle(pool, seed).slice(0, perCategory)) chosen.add(b.id);
  }
  return briefs.filter((b) => chosen.has(b.id));
}

/** Fisher-Yates with a seeded PRNG. */
function shuffle<T>(items: T[], seed: number): T[] {
  const rand = rng(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
