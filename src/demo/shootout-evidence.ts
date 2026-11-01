// The image-level evidence the demo shows: the latest shootout run a judge picked, brief by brief.
import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { loadShootout, type ShootoutManifest } from "../generation/manifest.ts";
import type { PickJudge } from "../judging/pick-judge.ts";
import { isSplitPick, summarizePicks, type PickSummary } from "../judging/pick-summary.ts";
import { currentPicks, loadPicks, PICKS_FILE, type PickRecord } from "../judging/picks.ts";

export type ShootoutShot = { generator: string; url: string; probability: number; picked: boolean };

export type ShootoutBrief = {
  id: string; brief: string; expected: string; routed: string; routedGenerator: string; agreement: number;
  /** Fewer than half the orderings agreed on the pick. */
  split: boolean;
  shots: ShootoutShot[];
};

export type ShootoutEvidence = Pick<PickSummary, "picked" | "models" | "bestWas" | "meanAgreement"> & {
  run: string;
  data: string;
  defaultGenerator: string;
  briefs: ShootoutBrief[];
};

/** The evidence, and the image files it may serve: only images of the run, by the URL the page asks for. */
export type LoadedShootout = { evidence: ShootoutEvidence; files: Map<string, string> };

export const SHOOTOUT_IMAGE_PREFIX = "/shootout-images/";

/**
 * The newest run in `dir` that `judge` has picked under its current prompt. Run directories are named by timestamp,
 * so name order is time order. Anything unreadable is skipped, so the demo still starts with no shootout at all.
 */
export async function loadShootoutEvidence(dir: string, judge: Pick<PickJudge, "id" | "version">): Promise<LoadedShootout | undefined> {
  const runs = (await readdir(dir).catch(() => [] as string[])).sort().reverse();
  for (const run of runs) {
    const loaded = await loadRun(join(dir, run), judge).catch(() => undefined);
    if (loaded) return toEvidence(run, join(dir, run), ...loaded);
  }
  return undefined;
}

async function loadRun(runDir: string, judge: Pick<PickJudge, "id" | "version">): Promise<[ShootoutManifest, Map<string, PickRecord>] | undefined> {
  const picks = currentPicks(await loadPicks(join(runDir, PICKS_FILE)), judge);
  return picks.size ? [await loadShootout(runDir), picks] : undefined;
}

function toEvidence(run: string, runDir: string, manifest: ShootoutManifest, picks: Map<string, PickRecord>): LoadedShootout {
  const files = new Map<string, string>();
  const briefs = manifest.items.flatMap((item): ShootoutBrief[] => {
    const pick = picks.get(item.id);
    if (!pick) return [];
    const shots = item.shots.map((shot) => {
      const url = `${SHOOTOUT_IMAGE_PREFIX}${encodeURIComponent(basename(shot.image))}`;
      files.set(url, join(runDir, shot.image));
      return { generator: shot.generator, url, probability: pick.probabilities[shot.generator] ?? 0, picked: shot.generator === pick.best };
    });
    const routedGenerator = manifest.meta.lineup[item.route.choice] ?? "";
    return [{ id: item.id, brief: item.brief, expected: item.expected, routed: item.route.choice, routedGenerator, agreement: pick.agreement, split: isSplitPick(pick), shots }];
  });
  const { picked, models, bestWas, meanAgreement } = summarizePicks(manifest, picks);
  return { evidence: { run, data: manifest.meta.data, defaultGenerator: manifest.meta.defaultGenerator, picked, models, bestWas, meanAgreement, briefs }, files };
}
