import { join } from "node:path";
import type { Brief } from "../evaluation/briefs.ts";
import type { Route, Router } from "../routing/router.ts";
import type { Generator } from "./generator.ts";

/** One image in a pair. `image` is relative to the run directory, so a run can be moved or archived. */
export type Shot = { generator: string; image: string; latencyMs: number };

/**
 * A brief routed and rendered twice: by the model routing picked and by the single default model.
 * When both are the same model there is one image and the pair is a tie by construction.
 */
export type PairItem = {
  id: string;
  brief: string;
  expected: string;
  route: Pick<Route, "choice" | "confidence" | "model">;
  routed: Shot;
  default: Shot;
};

/** A brief routed to a category with no generator (e.g. video), so it has nothing to compare. */
export type SkippedItem = { id: string; brief: string; expected: string; route: PairItem["route"]; skipped: string };

export type GenerationItem = PairItem | SkippedItem;

export const isPair = (item: GenerationItem): item is PairItem => !("skipped" in item);

export type Lineup = { byCategory: Record<string, Generator>; fallback: Generator };

export type GenerationOptions = {
  dir: string;
  seed: number;
  /** Items from an earlier, interrupted run of the same directory. Their route and images are kept. */
  previous?: Map<string, GenerationItem>;
  onItem?: (item: GenerationItem) => Promise<void> | void;
};

export const IMAGES_DIR = "images";

/** Routes each brief, then renders it with the routed generator and the default one. */
export async function runGeneration(router: Router, lineup: Lineup, briefs: Brief[], options: GenerationOptions): Promise<GenerationItem[]> {
  const items: GenerationItem[] = [];
  for (const brief of briefs) {
    const item = options.previous?.get(brief.id) ?? (await generatePair(router, lineup, brief, options));
    items.push(item);
    await options.onItem?.(item);
  }
  return items;
}

async function generatePair(router: Router, lineup: Lineup, brief: Brief, { dir, seed }: GenerationOptions): Promise<GenerationItem> {
  const { choice, confidence, model } = await router.route(brief.brief);
  const base = { id: brief.id, brief: brief.brief, expected: brief.expected, route: { choice, confidence, model } };
  const routedGenerator = lineup.byCategory[choice];
  if (!routedGenerator) return { ...base, skipped: `no generator for category "${choice}"` };

  const shoot = async (generator: Generator): Promise<Shot> => {
    const image = join(IMAGES_DIR, `${brief.id}-${fileSafe(generator.name)}.png`);
    const { latencyMs } = await generator.generate({ prompt: brief.brief, seed, outputPath: join(dir, image) });
    return { generator: generator.name, image, latencyMs };
  };
  const routed = await shoot(routedGenerator);
  const fallback = lineup.fallback.name === routedGenerator.name ? routed : await shoot(lineup.fallback);
  return { ...base, routed, default: fallback };
}

const fileSafe = (name: string) => name.replace(/[^a-z0-9.-]+/gi, "_");
