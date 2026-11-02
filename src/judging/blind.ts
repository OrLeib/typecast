import { rng } from "../shared/stats.ts";

export type Side = "left" | "right";

/** Different seeds, so a pair's side and its place in the order are unrelated. */
const SIDE_SEED = 1;
const ORDER_SEED = 2;

/**
 * Which side the routed image sits on. Random-looking so the judge can't learn a position, but
 * derived from the pair id so a reload shows the same layout.
 */
export function routedSide(id: string): Side {
  return rng(hashId(id, SIDE_SEED))() < 0.5 ? "left" : "right";
}

/** Judging order: shuffled by id so neighbouring briefs (often the same category) don't arrive together. */
export function blindOrder<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => hashId(a.id, ORDER_SEED) - hashId(b.id, ORDER_SEED));
}

/** FNV-1a over the id's characters, starting from the seed. */
function hashId(id: string, seed: number): number {
  let hash = seed >>> 0;
  for (const ch of id) hash = Math.imul(hash ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return hash;
}
