import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadBriefs } from "../evaluation/briefs.ts";
import { createLocalLineup, LOCAL_LINEUP } from "../generation/local-lineup.ts";
import { loadManifestIfAny, loadShootoutIfAny, MANIFEST_FILE, saveManifest, SHOOTOUT_FILE, type GenerationMeta } from "../generation/manifest.ts";
import { isPair, runGeneration, type GenerationItem, type RunOptions } from "../generation/runner.ts";
import { selectSample } from "../generation/sample.ts";
import { runShootout, type ShootoutItem } from "../generation/shootout.ts";
import { createJevClient } from "../jev/client.ts";
import { createDecisionRouter } from "../routing/router.ts";
import { DEFAULT_VARIANT, getVariant } from "../routing/variants.ts";
import { currentCommit, jevConfigFromEnv } from "./config.ts";

const { values: args } = parseArgs({
  options: {
    data: { type: "string", default: "data/dev.jsonl" },
    variant: { type: "string", default: DEFAULT_VARIANT },
    "per-category": { type: "string", default: "10" },
    seed: { type: "string", default: "1" },
    out: { type: "string" },
    // Every lineup model renders every brief, for a judge to pick the best of the set (`npm run pick-jev`).
    shootout: { type: "boolean", default: false },
  },
});
const perCategory = positiveInt("--per-category", args["per-category"]);
const seed = positiveInt("--seed", args.seed);

const lineup = createLocalLineup();
const meta: GenerationMeta = {
  data: args.data,
  variant: args.variant,
  seed,
  perCategory,
  defaultGenerator: lineup.fallback.name,
  lineup: Object.fromEntries(Object.entries(lineup.byCategory).map(([category, g]) => [category, g.name])),
  commit: currentCommit(),
  createdAt: new Date().toISOString(),
};

const dir = args.out ?? join("runs", args.shootout ? "shootout" : "level2", meta.createdAt.replace(/[:.]/g, "-"));
const briefs = selectSample(await loadBriefs(args.data), { perCategory, categories: Object.keys(LOCAL_LINEUP), seed });
const router = createDecisionRouter(createJevClient(jevConfigFromEnv()), getVariant(args.variant));
if (args.shootout) {
  const generators = Object.values(lineup.byCategory);
  await resumable(await loadShootoutIfAny(dir), {
    file: SHOOTOUT_FILE, setup: `models=${generators.length}`, run: (options) => runShootout(router, generators, briefs, options), describeItem: describeShootout,
  });
  console.log(`Pick with: npm run pick-jev -- ${dir}`);
} else {
  await resumable(await loadManifestIfAny(dir), {
    file: MANIFEST_FILE, setup: `default=${meta.defaultGenerator}`, run: (options) => runGeneration(router, lineup, briefs, options), describeItem: describe,
  });
  console.log(`Judge with: npm run judge -- ${dir}`);
}

/** One kind of run: the file it saves to, its setup for the log, how to run it, and how to log an item. */
type RunKind<T> = { file: string; setup: string; run: (options: RunOptions<T>) => Promise<unknown>; describeItem: (item: T) => string };

/** Runs `run` over the sample, keeping what an earlier run of `dir` saved in `file` and saving after every item. */
async function resumable<T extends { id: string }>(
  existing: { meta: GenerationMeta; items: T[] } | undefined,
  { file, setup, run, describeItem }: RunKind<T>,
): Promise<void> {
  if (existing) assertSameSetup(existing.meta, meta);
  const done: T[] = [];
  console.log(`${existing ? "resuming" : "writing"} ${dir}  briefs=${briefs.length}  ${setup}`);
  await run({
    dir,
    seed,
    previous: new Map(existing?.items.map((item) => [item.id, item])),
    onItem: async (item) => {
      done.push(item);
      await saveManifest(dir, { meta: existing?.meta ?? meta, items: done }, file);
      console.log(`  ${String(done.length).padStart(3)}/${briefs.length} ${describeItem(item)}`);
    },
  });
  console.log(`saved ${join(dir, file)}`);
}

// Function declarations, not consts: the top-level awaits above call them before this point is reached.
function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(0)}s`;
}

function describeRoute(item: GenerationItem | ShootoutItem): string {
  return `${item.id} -> ${item.route.choice} (${item.route.confidence.toFixed(2)})`;
}

function describeShootout(item: ShootoutItem): string {
  return `${describeRoute(item)}  ${seconds(item.shots.reduce((sum, shot) => sum + shot.latencyMs, 0))}`;
}

function describe(item: GenerationItem): string {
  const route = describeRoute(item);
  if (!isPair(item)) return `${route}  skipped: ${item.skipped}`;
  if (item.routed.generator === item.default.generator) return `${route}  same model as default ${seconds(item.routed.latencyMs)}`;
  return `${route}  routed ${seconds(item.routed.latencyMs)}  default ${seconds(item.default.latencyMs)}`;
}

/** Resuming with different settings would mix two experiments in one manifest. */
function assertSameSetup(saved: GenerationMeta, now: GenerationMeta): void {
  const keys = ["data", "variant", "seed", "perCategory", "defaultGenerator", "lineup"] as const;
  const changed = keys.filter((k) => JSON.stringify(saved[k]) !== JSON.stringify(now[k]));
  if (changed.length) throw new Error(`${dir} was generated with different ${changed.join(", ")}. Use a new --out.`);
}

function positiveInt(flag: string, value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${flag} must be a positive integer, got ${value}`);
  return n;
}
