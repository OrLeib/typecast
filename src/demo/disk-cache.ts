// A small JSON cache on disk, so demo results survive restarts and repeat requests cost no API calls.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type DiskCache<T> = { get(key: string): Promise<T | undefined>; set(key: string, value: T): Promise<void> };

/** Hex characters of the key's sha256 used as the file name: plenty to never collide in a demo's lifetime. */
const NAME_CHARS = 16;

/** One JSON file per key in `dir`. A missing or unreadable file is a miss, so a bad entry just gets recomputed. */
export function createDiskCache<T>(dir: string): DiskCache<T> {
  const fileFor = (key: string) => join(dir, `${createHash("sha256").update(key).digest("hex").slice(0, NAME_CHARS)}.json`);
  return {
    async get(key) {
      try {
        return JSON.parse(await readFile(fileFor(key), "utf8")) as T;
      } catch {
        return undefined;
      }
    },
    async set(key, value) {
      await mkdir(dir, { recursive: true });
      await writeFile(fileFor(key), JSON.stringify(value));
    },
  };
}
