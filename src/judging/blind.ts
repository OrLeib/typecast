import { rng } from "../comparison/stats.ts";

export type Side = "left" | "right";

/**
 * Which side the routed image sits on. Random-looking so the judge can't learn a position, but
 * derived from the pair id so a reload shows the same layout.
 */
export function routedSide(id: string, seed = 1): Side {
  return rng(hashId(id, seed))() < 0.5 ? "left" : "right";
}

/** Judging order: shuffled by id so neighbouring briefs (often the same category) don't arrive together. */
export function blindOrder<T extends { id: string }>(items: T[], seed = 1): T[] {
  return [...items].sort((a, b) => hashId(a.id, seed + 1) - hashId(b.id, seed + 1));
}

/** FNV-1a over the id's characters, starting from the seed. */
function hashId(id: string, seed: number): number {
  let hash = seed >>> 0;
  for (const ch of id) hash = Math.imul(hash ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return hash;
}
