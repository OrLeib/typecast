// POST /api/judge: have the judge pick between a routed and a default image the demo rendered, cached per pair.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { JudgedImage, PairJudge, PairVerdict } from "../judging/pair-judge.ts";
import { inputCostUsd } from "../shared/cost.ts";
import { HttpError } from "../shared/http.ts";
import { cachedOrCompute, createDiskCache } from "./disk-cache.ts";
import { imageFileFromUrl } from "./images.ts";
import { briefFrom } from "./requests.ts";

export type JudgeApiConfig = { judge: PairJudge; imagesDir: string; inputPricePerMillion: number; cacheDir: string };

export function createJudgeApi({ judge, imagesDir, inputPricePerMillion, cacheDir }: JudgeApiConfig) {
  const cache = createDiskCache<PairVerdict>(cacheDir);

  /** Reads an image this demo rendered, named by the URL `/api/generate` returned for it. */
  async function imageFrom(url: unknown, field: string): Promise<JudgedImage> {
    const file = imageFileFromUrl(url);
    if (!file) throw new HttpError(400, `${field} must be an image URL from /api/generate`);
    const bytes = await readFile(join(imagesDir, file)).catch(() => {
      throw new HttpError(404, `${field} image not found; render it first`);
    });
    return { format: "png", data: bytes };
  }

  return async (body: Record<string, unknown>) => {
    const brief = briefFrom(body);
    const routed = await imageFrom(body.routed, "routed");
    const dflt = await imageFrom(body.default, "default");
    // Image URLs are content hashes of model, seed and brief, so they name the exact pair being judged.
    const verdict = await cachedOrCompute(cache, `${judge.version}\n${body.routed}\n${body.default}\n${brief}`, () => judge.judge({ brief, routed, default: dflt }));
    return { ...verdict, costUsd: verdict.cached ? 0 : inputCostUsd(verdict.inputTokens, inputPricePerMillion) };
  };
}
