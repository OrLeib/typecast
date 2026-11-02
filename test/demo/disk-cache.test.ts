import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDiskCache } from "../../src/demo/disk-cache.ts";

let dir = "";
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("createDiskCache", () => {
  it("stores values by key on disk, creating its directory, so a new cache over the same dir reads them back", async () => {
    dir = join(await mkdtemp(join(tmpdir(), "typecast-cache-")), "routes");
    await createDiskCache<{ n: number }>(dir).set("brief a", { n: 1 });
    const reopened = createDiskCache<{ n: number }>(dir);
    expect(await reopened.get("brief a")).toEqual({ n: 1 });
    expect(await reopened.get("brief b")).toBeUndefined();
  });

  it("treats an unreadable entry as a miss", async () => {
    dir = await mkdtemp(join(tmpdir(), "typecast-cache-"));
    const cache = createDiskCache(dir);
    await cache.set("k", { ok: true });
    const [file] = await readdir(dir);
    await writeFile(join(dir, file), "{not json");
    expect(await cache.get("k")).toBeUndefined();
  });

  it("falls back to read-only seed folders on a miss, without ever writing to them", async () => {
    dir = await mkdtemp(join(tmpdir(), "typecast-cache-"));
    const seed = join(dir, "seed");
    await createDiskCache(seed).set("baked", { from: "seed" });
    const cache = createDiskCache(join(dir, "live"), seed);
    expect(await cache.get("baked")).toEqual({ from: "seed" });
    await cache.set("baked", { from: "live" });
    expect(await cache.get("baked")).toEqual({ from: "live" });
    expect(await createDiskCache(seed).get("baked")).toEqual({ from: "seed" });
  });
});
