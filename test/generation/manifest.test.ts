import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadManifest, loadManifestIfAny, loadShootout, loadShootoutIfAny, MANIFEST_FILE, saveManifest, SHOOTOUT_FILE, type Manifest, type ShootoutManifest,
} from "../../src/generation/manifest.ts";

const manifest: Manifest = {
  meta: { data: "d", variant: "v", seed: 1, perCategory: 1, defaultGenerator: "dflt", lineup: { photo: "photo-gen" }, commit: "c", createdAt: "t" },
  items: [
    {
      id: "a", brief: "b", expected: "photo", route: { choice: "photo", confidence: 0.9, model: "jev" },
      routed: { generator: "photo-gen", image: "images/a.png", latencyMs: 1 }, default: { generator: "dflt", image: "images/a-d.png", latencyMs: 2 },
    },
    { id: "v", brief: "clip", expected: "video", route: { choice: "video", confidence: 0.8, model: "jev" }, skipped: "no generator" },
  ],
};
let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "typecast-manifest-"));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("manifest store", () => {
  it("round-trips pairs and skipped items", async () => {
    await saveManifest(dir, manifest);
    expect(await loadManifest(dir)).toEqual(manifest);
  });

  it("names the file and field of a malformed item", async () => {
    const broken = { ...manifest, items: [{ ...manifest.items[0], routed: { generator: "photo-gen", image: "images/a.png" } }] };
    await writeFile(join(dir, MANIFEST_FILE), JSON.stringify(broken));
    await expect(loadManifest(dir)).rejects.toThrow(/manifest.json is not a generation manifest: items\[0\]\.routed\.latencyMs must be a number/);
  });

  it("treats a directory without a manifest as a fresh run", async () => {
    expect(await loadManifestIfAny(dir)).toBeUndefined();
  });

  it("round-trips a shootout in its own file, beside any pair manifest", async () => {
    const shootout: ShootoutManifest = {
      meta: manifest.meta,
      items: [{
        id: "a", brief: "b", expected: "photo", route: { choice: "photo", confidence: 0.9, model: "jev" },
        shots: [{ generator: "photo-gen", image: "images/a.png", latencyMs: 1 }, { generator: "dflt", image: "images/a-d.png", latencyMs: 2 }],
      }],
    };
    await saveManifest(dir, shootout, SHOOTOUT_FILE);
    expect(await loadShootout(dir)).toEqual(shootout);
    expect(await loadManifestIfAny(dir)).toBeUndefined();
  });

  it("names the file and field of a malformed shootout shot", async () => {
    await writeFile(join(dir, SHOOTOUT_FILE), JSON.stringify({ meta: manifest.meta, items: [{ ...manifest.items[0], shots: [{ generator: "g" }] }] }));
    await expect(loadShootout(dir)).rejects.toThrow(/shootout.json is not a shootout manifest: items\[0\]\.shots\[0\]\.image must be a string/);
  });

  it("treats a directory without a shootout as a fresh run", async () => {
    expect(await loadShootoutIfAny(dir)).toBeUndefined();
  });
});
