// A shootout renders each brief with every model in a lineup, so a judge can pick the best image of the set.
import type { Brief } from "../evaluation/briefs.ts";
import type { Router } from "../routing/router.ts";
import type { Generator } from "./generator.ts";
import { runEachBrief, shoot, type PairItem, type RunOptions, type Shot } from "./runner.ts";

/** A brief, where routing would send it, and one image per generator, in lineup order. */
export type ShootoutItem = Pick<PairItem, "id" | "brief" | "expected" | "route"> & { shots: Shot[] };

/**
 * Routes each brief (so a pick can be compared with the routed model) and renders it with every generator. Every
 * generator gets the same prompt and seed, so the images differ only by model.
 */
export function runShootout(router: Router, generators: Generator[], briefs: Brief[], options: RunOptions<ShootoutItem>): Promise<ShootoutItem[]> {
  return runEachBrief(briefs, options, (brief) => shootAll(router, generators, brief, options));
}

async function shootAll(router: Router, generators: Generator[], brief: Brief, options: RunOptions<ShootoutItem>): Promise<ShootoutItem> {
  const { choice, confidence, model } = await router.route(brief.brief);
  const shots: Shot[] = [];
  for (const generator of generators) shots.push(await shoot(generator, brief, options));
  return { id: brief.id, brief: brief.brief, expected: brief.expected, route: { choice, confidence, model }, shots };
}
