// POST /api/locate: find a described target in a sample or uploaded image and cut a padded square around it. Answers
// are cached per image and target, so moving the padding slider re-crops without another API call.
import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { cropSquare, previewOf, uprightSize } from "../locating/images.ts";
import type { Location, Locator } from "../locating/locator.ts";
import { squareCrop } from "../locating/square-crop.ts";
import { inputCostUsd } from "../shared/cost.ts";
import { shortHash } from "../shared/hash.ts";
import { HttpError } from "../shared/http.ts";
import { cachedOrCompute, createDiskCache } from "./disk-cache.ts";

export type LocateApiConfig = {
  locator: Locator;
  /** Everything besides the image and target that changes a box (Jev model, base URL), so a change misses the cache. */
  locatorId: string;
  inputPricePerMillion: number;
  /** Folders of sample images, searched in order: committed samples first, then local-only ones that can't be published. */
  samplesDirs: string[];
  cacheDir: string;
  /** Read-only answers baked in when the hosted site is built, so trying the samples costs nothing. */
  bakedAnswerDirs: string[];
};

export const SAMPLE_IMAGE_PREFIX = "/locate-samples/";
/** What the page asks for until the user types something else; the hosted site bakes the samples' answers for it. */
export const DEFAULT_TARGET = "the person's face";
export const SAMPLE_TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

const DATA_URL = /^data:image\/(png|jpe?g);base64,(.+)$/;
/** A target is a short noun phrase; anything longer is almost certainly a mistake, and Jev bills per input token. */
const MAX_TARGET_CHARS = 200;
/** Padding beyond this only crops the whole image. */
const MAX_PADDING = 2;
/** The crop shows in a card about 260px wide; twice that stays sharp on a retina screen. */
const PREVIEW_SIDE = 520;

export function createLocateApi({ locator, locatorId, inputPricePerMillion, samplesDirs, cacheDir, bakedAnswerDirs }: LocateApiConfig) {
  const cache = createDiskCache<Location>(cacheDir, bakedAnswerDirs);
  return {
    samples: async () => ({ samples: [...(await findSamples(samplesDirs)).keys()].map((name) => ({ name, url: SAMPLE_IMAGE_PREFIX + name })) }),
    locate: async (body: Record<string, unknown>) => {
      const { name, bytes } = await imageFrom(body, samplesDirs);
      const target = targetFrom(body);
      const padding = paddingFrom(body);
      const location = await cachedOrCompute(cache, locateCacheKey(locatorId, bytes, target), () => locator.locate(bytes, target));
      const size = await uprightSize(bytes);
      const crop = squareCrop(location.box, size, padding);
      const preview = await previewOf(await cropSquare(bytes, crop), PREVIEW_SIDE);
      return {
        ...location,
        name,
        size,
        crop,
        cropUrl: `data:image/webp;base64,${preview.toString("base64")}`,
        costUsd: location.cached ? 0 : inputCostUsd(location.inputTokens, inputPricePerMillion),
      };
    },
  };
}

/** Which Jev answers boxes. Local and hosted demos compute it the same way, so answers baked at build time match. */
export const locatorIdOf = (jev: { model: string; baseUrl: string }) => JSON.stringify({ model: jev.model, baseUrl: jev.baseUrl });

/** Everything that changes an answer: the locator, the image's bytes and the target. Baking the samples uses it too. */
export const locateCacheKey = (locatorId: string, bytes: Buffer, target: string) => [locatorId, shortHash(bytes), target].join("\n");

/** Every sample image by file name, mapped to its path. A name in an earlier folder wins. */
export async function findSamples(dirs: string[]): Promise<Map<string, string>> {
  const samples = new Map<string, string>();
  for (const dir of dirs) {
    const names = await readdir(dir).catch(() => [] as string[]);
    for (const name of names.filter((n) => extname(n).toLowerCase() in SAMPLE_TYPES).sort()) if (!samples.has(name)) samples.set(name, join(dir, name));
  }
  return samples;
}

/** The image is either a sample's file name or an uploaded PNG or JPEG data URL. */
async function imageFrom(body: Record<string, unknown>, samplesDirs: string[]): Promise<{ name: string; bytes: Buffer }> {
  if (typeof body.sample === "string") {
    const name = basename(body.sample);
    const path = (await findSamples(samplesDirs)).get(name);
    if (!path) throw new HttpError(404, `no sample named ${name}`);
    return { name, bytes: await readFile(path) };
  }
  const match = typeof body.image === "string" ? DATA_URL.exec(body.image) : null;
  if (!match) throw new HttpError(400, "send a sample name, or an image as a PNG or JPEG data URL");
  return { name: "upload", bytes: Buffer.from(match[2], "base64") };
}

function targetFrom(body: Record<string, unknown>): string {
  const target = typeof body.target === "string" ? body.target.trim() : "";
  if (!target) throw new HttpError(400, "target must be a non-empty string");
  if (target.length > MAX_TARGET_CHARS) throw new HttpError(400, `target must be at most ${MAX_TARGET_CHARS} characters`);
  return target;
}

function paddingFrom(body: Record<string, unknown>): number {
  const padding = body.padding;
  if (typeof padding !== "number" || !Number.isFinite(padding) || padding < 0 || padding > MAX_PADDING) {
    throw new HttpError(400, `padding must be a number from 0 to ${MAX_PADDING}`);
  }
  return padding;
}
