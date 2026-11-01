import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { GenerationItem } from "./runner.ts";

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

export const MANIFEST_FILE = "manifest.json";

export async function saveManifest(dir: string, manifest: Manifest): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, MANIFEST_FILE), JSON.stringify(manifest, null, 2));
}

export async function loadManifest(dir: string): Promise<Manifest> {
  const file = join(dir, MANIFEST_FILE);
  const manifest = JSON.parse(await readFile(file, "utf8")) as Manifest;
  if (!manifest.meta?.defaultGenerator || !Array.isArray(manifest.items)) {
    throw new Error(`${file} is not a generation manifest (needs meta.defaultGenerator and items)`);
  }
  return manifest;
}

/** Returns the manifest in `dir`, or undefined when the directory has none yet. */
export async function loadManifestIfAny(dir: string): Promise<Manifest | undefined> {
  return loadManifest(dir).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return undefined;
    throw e;
  });
}
