// POST /api/locate: find a described target in several sample or uploaded images at once, and cut a padded square
// around it in each. Answers are cached per image and target, so moving the padding slider or changing the selection
// asks only about images not yet seen.
import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { cropSquare, previewOf, uprightSize } from "../locating/images.ts";
import { MAX_IMAGES, type Found, type Located, type Locator } from "../locating/locator.ts";
import { squareCrop } from "../locating/square-crop.ts";
import { inputCostUsd } from "../shared/cost.ts";
import { shortHash } from "../shared/hash.ts";
import { HttpError } from "../shared/http.ts";
import { createDiskCache } from "./disk-cache.ts";

export type LocateApiConfig = {
  locator: Locator;
  /** Everything besides the images and target that changes a box (Jev model, base URL), so a change misses the cache. */
  locatorId: string;
  inputPricePerMillion: number;
  /** Folders of sample images, searched in order: committed samples first, then local-only ones that can't be published. */
  samplesDirs: string[];
  cacheDir: string;
  /** Read-only answers baked in when the hosted site is built, so trying the samples costs nothing. */
  bakedAnswerDirs: string[];
};

/** One image's cached answer. The model is kept per answer, since a response can mix fresh and cached ones. */
type CachedFind = Found & { model: string };

export const SAMPLE_IMAGE_PREFIX = "/locate-samples/";
/** What the page asks for until the user types something else; the hosted site bakes the samples' answers for it. */
export const DEFAULT_TARGET = "the person's face";
export const SAMPLE_TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

const DATA_URL = /^data:image\/(png|jpe?g);base64,(.+)$/;
/** A target is a short noun phrase; anything longer is almost certainly a mistake, and Jev bills per input token. */
const MAX_TARGET_CHARS = 200;
/** Padding beyond this only crops the whole image. */
const MAX_PADDING = 2;
/** Crops show in cards about 260px wide; twice that stays sharp on a retina screen. */
const PREVIEW_SIDE = 520;

type NamedImage = { name: string; bytes: Buffer };

export function createLocateApi({ locator, locatorId, inputPricePerMillion, samplesDirs, cacheDir, bakedAnswerDirs }: LocateApiConfig) {
  const cache = createDiskCache<CachedFind>(cacheDir, bakedAnswerDirs);
  const keyFor = (bytes: Buffer, target: string) => locateCacheKey(locatorId, bytes, target);

  /** Each image's answer in order, asking the locator once about all the images it has no answer for. */
  async function answers(images: NamedImage[], target: string): Promise<{ found: CachedFind[]; fresh?: Located }> {
    const hits = await Promise.all(images.map(({ bytes }) => cache.get(keyFor(bytes, target))));
    const missing = images.filter((_, i) => !hits[i]);
    if (missing.length === 0) return { found: hits as CachedFind[] };
    const fresh = await locator.locate(missing.map(({ bytes }) => bytes), target);
    const asked = missing.map((image, i): CachedFind => ({ ...fresh.found[i], model: fresh.model }));
    await Promise.all(missing.map((image, i) => cache.set(keyFor(image.bytes, target), asked[i])));
    let next = 0;
    return { found: hits.map((hit) => hit ?? asked[next++]), fresh };
  }

  return {
    samples: async () => ({ samples: [...(await findSamples(samplesDirs)).keys()].map((name) => ({ name, url: SAMPLE_IMAGE_PREFIX + name })) }),
    locate: async (body: Record<string, unknown>) => {
      const images = await imagesFrom(body, samplesDirs);
      const target = targetFrom(body);
      const padding = paddingFrom(body);
      const { found, fresh } = await answers(images, target);
      const inputTokens = fresh?.inputTokens ?? 0;
      return {
        images: await Promise.all(images.map((image, i) => cropAround(image, found[i], padding))),
        model: fresh?.model ?? found[0].model,
        inputTokens,
        latencyMs: fresh?.latencyMs ?? 0,
        costUsd: inputCostUsd(inputTokens, inputPricePerMillion),
        cached: !fresh,
      };
    },
  };
}

/** Which Jev answers boxes. Local and hosted demos compute it the same way, so answers baked at build time match. */
export const locatorIdOf = (jev: { model: string; baseUrl: string }) => JSON.stringify({ model: jev.model, baseUrl: jev.baseUrl });

/** Everything that changes an answer: the locator, the image's bytes and the target. Baking the samples uses it too. */
export const locateCacheKey = (locatorId: string, bytes: Buffer, target: string) => [locatorId, shortHash(bytes), target].join("\n");

async function cropAround({ name, bytes }: NamedImage, { box, confidence, presence }: Found, padding: number) {
  const size = await uprightSize(bytes);
  const crop = squareCrop(box, size, padding);
  const preview = await previewOf(await cropSquare(bytes, crop), PREVIEW_SIDE);
  return { name, size, box, confidence, presence, crop, cropUrl: `data:image/webp;base64,${preview.toString("base64")}` };
}

/** Every sample image by file name, mapped to its path. A name in an earlier folder wins. */
export async function findSamples(dirs: string[]): Promise<Map<string, string>> {
  const samples = new Map<string, string>();
  for (const dir of dirs) {
    const names = await readdir(dir).catch(() => [] as string[]);
    for (const name of names.filter((n) => extname(n).toLowerCase() in SAMPLE_TYPES).sort()) if (!samples.has(name)) samples.set(name, join(dir, name));
  }
  return samples;
}

/** Samples by file name first, then uploads as PNG or JPEG data URLs, in the order given. */
async function imagesFrom(body: Record<string, unknown>, samplesDirs: string[]): Promise<NamedImage[]> {
  const names = stringList(body.samples, "samples");
  const uploads = stringList(body.images, "images");
  const count = names.length + uploads.length;
  if (count === 0 || count > MAX_IMAGES) throw new HttpError(400, `send 1 to ${MAX_IMAGES} images, got ${count}`);
  const samples = await findSamples(samplesDirs);
  const fromSamples = names.map(async (raw) => {
    const name = basename(raw);
    const path = samples.get(name);
    if (!path) throw new HttpError(404, `no sample named ${name}`);
    return { name, bytes: await readFile(path) };
  });
  const fromUploads = uploads.map(async (url, i) => {
    const match = DATA_URL.exec(url);
    if (!match) throw new HttpError(400, `images[${i}] must be a PNG or JPEG data URL`);
    return { name: `upload ${i + 1}`, bytes: Buffer.from(match[2], "base64") };
  });
  return Promise.all([...fromSamples, ...fromUploads]);
}

function stringList(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) throw new HttpError(400, `${field} must be a list of strings`);
  return value;
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
