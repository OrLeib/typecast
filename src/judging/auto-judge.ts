// Runs an auto-judge over every pair in a Level 2 run that still needs it, appending to the run's judgments.
import { join } from "node:path";
import type { Manifest } from "../generation/manifest.ts";
import type { PairItem } from "../generation/runner.ts";
import { appendJudgment, JUDGMENTS_FILE, latestByPair, loadJudgments } from "./judgments.ts";
import { loadImage, type PairJudge, type PairVerdict } from "./pair-judge.ts";
import { needsJudging } from "./pairs.ts";

export type AutoJudgeOptions = { now?: () => Date; onJudged?: (item: PairItem, verdict: PairVerdict) => void };

/** Judges pairs this judge has not judged yet, so an interrupted run resumes where it stopped. Returns the input tokens spent. */
export async function autoJudgeRun(judge: PairJudge, dir: string, manifest: Manifest, options: AutoJudgeOptions = {}): Promise<number> {
  const now = options.now ?? (() => new Date());
  const file = join(dir, JUDGMENTS_FILE);
  const done = latestByPair(await loadJudgments(file), judge.id);
  let inputTokens = 0;
  for (const item of manifest.items.filter(needsJudging)) {
    if (done.has(item.id)) continue;
    const verdict = await judge.judge({
      brief: item.brief,
      routed: await loadImage(dir, item.routed.image),
      default: await loadImage(dir, item.default.image),
    });
    const { winner, probabilities, model } = verdict;
    await appendJudgment(file, { id: item.id, winner, judge: judge.id, at: now().toISOString(), model, probabilities });
    inputTokens += verdict.inputTokens;
    options.onJudged?.(item, verdict);
  }
  return inputTokens;
}
