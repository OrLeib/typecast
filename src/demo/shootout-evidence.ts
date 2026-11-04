// The image-level evidence the demo shows: the latest shootout run a judge picked, brief by brief.
import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { loadShootout, type ShootoutManifest } from "../generation/manifest.ts";
import type { ImageRater } from "../judging/image-rater.ts";
import type { PickJudge } from "../judging/pick-judge.ts";
import { isSplitPick, summarizePicks, type PickSummary } from "../judging/pick-summary.ts";
import { currentPicks, loadPicks, PICKS_FILE, type PickRecord } from "../judging/picks.ts";
import { currentRatings, loadRatings, RATINGS_FILE, summarizeRatings, type RatingRecord, type Ratings, type RatingSummary } from "../judging/ratings.ts";

export type ShootoutShot = {
  generator: string; url: string; probability: number; picked: boolean;
  /** The image's rubric marks, once the run has been rated. */
  rating?: Pick<RatingRecord, "scores" | "total">;
};

export type ShootoutBrief = {
  id: string; brief: string; expected: string; routed: string; confidence: number; routedGenerator: string; agreement: number;
  /** Fewer than half the orderings agreed on the pick. */
  split: boolean;
  shots: ShootoutShot[];
};

export type ShootoutEvidence = Pick<PickSummary, "picked" | "models" | "bestWas" | "meanAgreement"> & {
  run: string;
  data: string;
  defaultGenerator: string;
  /** Model category -> the generator that renders it. */
  lineup: Record<string, string>;
  briefs: ShootoutBrief[];
  /** How the rubric's top marks stand against the picks, once the run has been rated. */
  rubric?: RatingSummary;
};

/** The evidence, and the image files it may serve: only images of the run, by the URL the page asks for. */
export type LoadedShootout = { dir: string; evidence: ShootoutEvidence; files: Map<string, string> };

export const SHOOTOUT_IMAGE_PREFIX = "/shootout-images/";

/**
 * The newest run in `dir` that `judge` has picked under its current prompt. Run directories are named by timestamp,
 * so name order is time order. Anything unreadable is skipped, so the demo still starts with no shootout at all.
 */
export async function loadShootoutEvidence(dir: string, judge: Pick<PickJudge, "id" | "version">, rater: Pick<ImageRater, "id" | "version">): Promise<LoadedShootout | undefined> {
  const runs = (await readdir(dir).catch(() => [] as string[])).sort().reverse();
  for (const run of runs) {
    const loaded = await loadRun(join(dir, run), judge, rater).catch(() => undefined);
    if (loaded) return toEvidence(run, join(dir, run), loaded);
  }
  return undefined;
}

type JudgedRun = { manifest: ShootoutManifest; picks: Map<string, PickRecord>; ratings: Ratings };

async function loadRun(runDir: string, judge: Pick<PickJudge, "id" | "version">, rater: Pick<ImageRater, "id" | "version">): Promise<JudgedRun | undefined> {
  const picks = currentPicks(await loadPicks(join(runDir, PICKS_FILE)), judge);
  if (!picks.size) return undefined;
  return { manifest: await loadShootout(runDir), picks, ratings: currentRatings(await loadRatings(join(runDir, RATINGS_FILE)), rater) };
}

function toEvidence(run: string, runDir: string, { manifest, picks, ratings }: JudgedRun): LoadedShootout {
  const files = new Map<string, string>();
  const briefs = manifest.items.flatMap((item): ShootoutBrief[] => {
    const pick = picks.get(item.id);
    if (!pick) return [];
    const shots = item.shots.map((shot) => {
      const url = `${SHOOTOUT_IMAGE_PREFIX}${encodeURIComponent(basename(shot.image))}`;
      files.set(url, join(runDir, shot.image));
      const rating = ratings.get(item.id)?.get(shot.generator);
      return { generator: shot.generator, url, probability: pick.probabilities[shot.generator] ?? 0, picked: shot.generator === pick.best, ...(rating ? { rating: { scores: rating.scores, total: rating.total } } : {}) };
    });
    const routedGenerator = manifest.meta.lineup[item.route.choice] ?? "";
    return [{ id: item.id, brief: item.brief, expected: item.expected, routed: item.route.choice, confidence: item.route.confidence, routedGenerator, agreement: pick.agreement, split: isSplitPick(pick), shots }];
  });
  const { picked, models, bestWas, meanAgreement } = summarizePicks(manifest, picks);
  const rubric = summarizeRatings(manifest, ratings, picks);
  return { dir: runDir, evidence: { run, data: manifest.meta.data, defaultGenerator: manifest.meta.defaultGenerator, lineup: manifest.meta.lineup, picked, models, bestWas, meanAgreement, briefs, ...(rubric.briefs ? { rubric } : {}) }, files };
}
