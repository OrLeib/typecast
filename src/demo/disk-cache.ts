// A small JSON cache on disk, so demo results survive restarts and repeat requests cost no API calls.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { shortHash } from "../shared/hash.ts";

export type DiskCache<T> = { get(key: string): Promise<T | undefined>; set(key: string, value: T): Promise<void> };

/**
 * One JSON file per key in `dir`. A missing or unreadable file is a miss, so a bad entry just gets recomputed.
 * `seedDirs` are read-only folders in the same format, read after `dir`: answers baked in when the hosted site is built.
 */
export function createDiskCache<T>(dir: string, seedDirs: string[] = []): DiskCache<T> {
  const fileIn = (folder: string, key: string) => join(folder, `${shortHash(key)}.json`);
  return {
    async get(key) {
      for (const folder of [dir, ...seedDirs]) {
        const hit = await readEntry<T>(fileIn(folder, key));
        if (hit !== undefined) return hit;
      }
      return undefined;
    },
    async set(key, value) {
      await mkdir(dir, { recursive: true });
      await writeFile(fileIn(dir, key), JSON.stringify(value));
    },
  };
}

async function readEntry<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return undefined;
  }
}

/** The cached value for `key`, or `compute`'s, stored for next time. `cached` says which, so the page can show it. */
export async function cachedOrCompute<T extends object>(cache: DiskCache<T>, key: string, compute: () => Promise<T>): Promise<T & { cached: boolean }> {
  const hit = await cache.get(key);
  if (hit) return { ...hit, cached: true };
  const value = await compute();
  await cache.set(key, value);
  return { ...value, cached: false };
}
