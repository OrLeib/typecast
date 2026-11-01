import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadBriefs } from "../evaluation/briefs.ts";
import { LOCAL_DEFAULT, LOCAL_LINEUP } from "../generation/local-lineup.ts";
import { loadManifestIfAny, saveManifest, type GenerationMeta } from "../generation/manifest.ts";
import { createMfluxGenerator } from "../generation/mflux.ts";
import { isPair, runGeneration, type GenerationItem, type Lineup } from "../generation/runner.ts";
import { selectSample } from "../generation/sample.ts";
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
  },
});
const perCategory = positiveInt("--per-category", args["per-category"]);
const seed = positiveInt("--seed", args.seed);

const byCategory = Object.fromEntries(Object.entries(LOCAL_LINEUP).map(([category, model]) => [category, createMfluxGenerator(model)]));
const lineup: Lineup = { byCategory, fallback: createMfluxGenerator(LOCAL_DEFAULT) };
const meta: GenerationMeta = {
  data: args.data,
  variant: args.variant,
  seed,
  perCategory,
  defaultGenerator: lineup.fallback.name,
  lineup: Object.fromEntries(Object.entries(byCategory).map(([category, g]) => [category, g.name])),
  commit: currentCommit(),
  createdAt: new Date().toISOString(),
};

const dir = args.out ?? join("runs", "level2", meta.createdAt.replace(/[:.]/g, "-"));
const existing = await loadManifestIfAny(dir);
if (existing) assertSameSetup(existing.meta, meta);
const runMeta = existing?.meta ?? meta;

const briefs = selectSample(await loadBriefs(args.data), { perCategory, categories: Object.keys(LOCAL_LINEUP), seed });
const router = createDecisionRouter(createJevClient(jevConfigFromEnv()), getVariant(args.variant));
const done: GenerationItem[] = [];
console.log(`${existing ? "resuming" : "writing"} ${dir}  briefs=${briefs.length}  default=${meta.defaultGenerator}`);

await runGeneration(router, lineup, briefs, {
  dir,
  seed,
  previous: new Map(existing?.items.map((item) => [item.id, item])),
  onItem: async (item) => {
    done.push(item);
    await saveManifest(dir, { meta: runMeta, items: done });
    console.log(`  ${String(done.length).padStart(3)}/${briefs.length} ${describe(item)}`);
  },
});
console.log(`saved ${join(dir, "manifest.json")}. Judge with: npm run judge -- ${dir}`);

function describe(item: GenerationItem): string {
  const route = `${item.id} -> ${item.route.choice} (${item.route.confidence.toFixed(2)})`;
  if (!isPair(item)) return `${route}  skipped: ${item.skipped}`;
  const seconds = (ms: number) => `${(ms / 1000).toFixed(0)}s`;
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
