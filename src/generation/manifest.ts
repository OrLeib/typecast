import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expectArray, expectNumber, expectProbability, expectRecord, expectString, withSource } from "../shared/validate.ts";
import type { GenerationItem, Shot } from "./runner.ts";
import type { ShootoutItem } from "./shootout.ts";

export type GenerationMeta = {
  data: string;
  variant: string;
  seed: number;
  perCategory: number;
  defaultGenerator: string;
  lineup: Record<string, string>;
  commit: string;
  createdAt: string;
};

/** Everything a generation run produced, saved as `manifest.json` next to its images. */
export type Manifest = { meta: GenerationMeta; items: GenerationItem[] };

/** A shootout run (every lineup model on every brief), saved as `shootout.json` next to its images. */
export type ShootoutManifest = { meta: GenerationMeta; items: ShootoutItem[] };

export const MANIFEST_FILE = "manifest.json";
export const SHOOTOUT_FILE = "shootout.json";

export async function saveManifest(dir: string, manifest: { meta: GenerationMeta; items: unknown[] }, file = MANIFEST_FILE): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, file), JSON.stringify(manifest, null, 2));
}

/** Reads the manifest in `dir`, throwing with the file and the offending field when it is malformed. */
export async function loadManifest(dir: string): Promise<Manifest> {
  return loadFrom(join(dir, MANIFEST_FILE), "a generation manifest", parseItem);
}

export async function loadShootout(dir: string): Promise<ShootoutManifest> {
  return loadFrom(join(dir, SHOOTOUT_FILE), "a shootout manifest", parseShootoutItem);
}

async function loadFrom<T>(file: string, what: string, parseItemAt: (raw: unknown, path: string) => T): Promise<{ meta: GenerationMeta; items: T[] }> {
  const text = await readFile(file, "utf8");
  return withSource(`${file} is not ${what}`, () => {
    const manifest = expectRecord(JSON.parse(text), "manifest");
    return { meta: parseMeta(manifest.meta), items: expectArray(manifest.items, "items").map((item, i) => parseItemAt(item, `items[${i}]`)) };
  });
}

function parseMeta(raw: unknown): GenerationMeta {
  const meta = expectRecord(raw, "meta");
  const lineup = expectRecord(meta.lineup, "meta.lineup");
  return {
    data: expectString(meta.data, "meta.data"),
    variant: expectString(meta.variant, "meta.variant"),
    seed: expectNumber(meta.seed, "meta.seed"),
    perCategory: expectNumber(meta.perCategory, "meta.perCategory"),
    defaultGenerator: expectString(meta.defaultGenerator, "meta.defaultGenerator"),
    lineup: Object.fromEntries(Object.entries(lineup).map(([category, name]) => [category, expectString(name, `meta.lineup.${category}`)])),
    commit: expectString(meta.commit, "meta.commit"),
    createdAt: expectString(meta.createdAt, "meta.createdAt"),
  };
}

function parseItem(raw: unknown, path: string): GenerationItem {
  const item = expectRecord(raw, path);
  const base = parseBriefRoute(item, path);
  if ("skipped" in item) return { ...base, skipped: expectString(item.skipped, `${path}.skipped`) };
  return { ...base, routed: parseShot(item.routed, `${path}.routed`), default: parseShot(item.default, `${path}.default`) };
}

function parseShootoutItem(raw: unknown, path: string): ShootoutItem {
  const item = expectRecord(raw, path);
  return { ...parseBriefRoute(item, path), shots: expectArray(item.shots, `${path}.shots`).map((shot, i) => parseShot(shot, `${path}.shots[${i}]`)) };
}

function parseBriefRoute(item: Record<string, unknown>, path: string): Omit<ShootoutItem, "shots"> {
  const route = expectRecord(item.route, `${path}.route`);
  return {
    id: expectString(item.id, `${path}.id`),
    brief: expectString(item.brief, `${path}.brief`),
    expected: expectString(item.expected, `${path}.expected`),
    route: {
      choice: expectString(route.choice, `${path}.route.choice`),
      confidence: expectProbability(route.confidence, `${path}.route.confidence`),
      model: expectString(route.model, `${path}.route.model`),
    },
  };
}

function parseShot(raw: unknown, path: string): Shot {
  const shot = expectRecord(raw, path);
  return {
    generator: expectString(shot.generator, `${path}.generator`),
    image: expectString(shot.image, `${path}.image`),
    latencyMs: expectNumber(shot.latencyMs, `${path}.latencyMs`),
  };
}

/** Returns the manifest in `dir`, or undefined when the directory has none yet. */
export const loadManifestIfAny = (dir: string) => undefinedIfMissing(loadManifest(dir));

export const loadShootoutIfAny = (dir: string) => undefinedIfMissing(loadShootout(dir));

const undefinedIfMissing = <T>(loading: Promise<T>): Promise<T | undefined> =>
  loading.catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return undefined;
    throw e;
  });
