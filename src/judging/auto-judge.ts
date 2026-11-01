// Runs the Jev judge over every pair in a Level 2 run that still needs it, appending to the run's judgments.
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { Manifest } from "../generation/manifest.ts";
import type { PairItem } from "../generation/runner.ts";
import type { DecisionClient } from "../jev/client.ts";
import type { ImageAsset } from "../jev/parse.ts";
import { judgeWithJev, type JevVerdict } from "./jev-judge.ts";
import { appendJudgment, JEV_JUDGE, JUDGMENTS_FILE, latestByPair, loadJudgments } from "./judgments.ts";
import { needsJudging } from "./win-rate.ts";

export type AutoJudgeOptions = { now?: () => Date; onJudged?: (item: PairItem, verdict: JevVerdict) => void };

/** Judges pairs not yet judged by Jev, so an interrupted run resumes where it stopped. Returns the input tokens spent. */
export async function autoJudgeRun(client: DecisionClient, dir: string, manifest: Manifest, options: AutoJudgeOptions = {}): Promise<number> {
  const now = options.now ?? (() => new Date());
  const file = join(dir, JUDGMENTS_FILE);
  const done = latestByPair(await loadJudgments(file), JEV_JUDGE);
  let inputTokens = 0;
  for (const item of manifest.items.filter(needsJudging)) {
    if (done.has(item.id)) continue;
    const verdict = await judgeWithJev(client, {
      brief: item.brief,
      routed: await loadImage(dir, item.routed.image),
      default: await loadImage(dir, item.default.image),
    });
    const { winner, probabilities, model } = verdict;
    await appendJudgment(file, { id: item.id, winner, judge: JEV_JUDGE, at: now().toISOString(), model, probabilities });
    inputTokens += verdict.inputTokens;
    options.onJudged?.(item, verdict);
  }
  return inputTokens;
}

const FORMATS: Record<string, ImageAsset["format"]> = { ".png": "png", ".jpg": "jpg", ".jpeg": "jpeg" };

async function loadImage(dir: string, relative: string): Promise<ImageAsset> {
  const format = FORMATS[extname(relative).toLowerCase()];
  if (!format) throw new Error(`${relative}: Jev takes PNG or JPEG images only`);
  return { type: "image", format, data_base64: (await readFile(join(dir, relative))).toString("base64") };
}
