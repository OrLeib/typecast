import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Manifest, ShootoutManifest } from "../../src/generation/manifest.ts";
import type { GenerationItem } from "../../src/generation/runner.ts";

/** A rendered pair whose default model is "dflt"; routing to "dflt" makes a same-model pair. */
export const pair = (id: string, routed: string): GenerationItem => ({
  id, brief: `brief ${id}`, expected: "photo",
  route: { choice: "photo", confidence: 0.9, model: "jev" },
  routed: { generator: routed, image: `images/${id}-${routed}.png`, latencyMs: 1 },
  default: { generator: "dflt", image: `images/${id}-dflt.png`, latencyMs: 1 },
});

export const manifestOf = (items: GenerationItem[]): Manifest => ({
  meta: { data: "d", variant: "v", seed: 1, perCategory: 1, defaultGenerator: "dflt", lineup: {}, commit: "c", createdAt: "t" },
  items,
});

/** A shootout over "photo-gen" (photo's model), "draw-gen" (illustration's) and "dflt"; brief `id` is routed to `choice`. */
export const shootoutOf = (items: { id: string; choice: string; expected?: string }[]): ShootoutManifest => ({
  meta: { ...manifestOf([]).meta, lineup: { photo: "photo-gen", illustration: "draw-gen" } },
  items: items.map(({ id, choice, expected = "photo" }) => ({
    id, brief: `brief <${id}>`, expected,
    route: { choice, confidence: 0.8, model: "jev" },
    shots: ["photo-gen", "draw-gen", "dflt"].map((generator) => ({ generator, image: `images/${id}-${generator}.png`, latencyMs: 1 })),
  })),
});

/** Writes every image of a shootout into `dir`, each file's bytes naming its brief and generator. */
export async function writeShootoutImages(dir: string, manifest: ShootoutManifest) {
  await mkdir(join(dir, "images"));
  for (const item of manifest.items) for (const shot of item.shots) await writeFile(join(dir, shot.image), `${item.id}-${shot.generator}`);
}
