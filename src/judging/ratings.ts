// Rubric scores over a shootout run: running an ImageRater over every image, the append-only file it writes, and how
// the scores stand against the picks.
import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import type { ShootoutManifest } from "../generation/manifest.ts";
import { loadJsonLines } from "../shared/files.ts";
import { expectProbabilities, expectProbability, expectString } from "../shared/validate.ts";
import type { ImageRater } from "./image-rater.ts";
import { loadImage } from "./pair-judge.ts";
import type { PickRecord } from "./picks.ts";

/** One judge's scores for one image of one brief. */
export type RatingRecord = {
  id: string;
  generator: string;
  judge: string;
  /** The rubric's version: scores made under another rubric are not reused. */
  version: string;
  model: string;
  scores: Record<string, number>;
  total: number;
  at: string;
};

export const RATINGS_FILE = "ratings.jsonl";

/** Brief id -> generator -> its scores. */
export type Ratings = Map<string, Map<string, RatingRecord>>;

export type RateRunOptions = { now?: () => Date; onRated?: (item: ShootoutManifest["items"][number], rating: RatingRecord) => void };

/** Scores every image this rater hasn't under its current rubric, so an interrupted run resumes. Returns the input tokens spent. */
export async function rateRun(rater: ImageRater, dir: string, manifest: ShootoutManifest, options: RateRunOptions = {}): Promise<number> {
  const now = options.now ?? (() => new Date());
  const file = join(dir, RATINGS_FILE);
  const done = currentRatings(await loadRatings(file), rater);
  let inputTokens = 0;
  for (const item of manifest.items) {
    for (const shot of item.shots.filter((s) => !done.get(item.id)?.has(s.generator))) {
      const { scores, total, model, inputTokens: spent } = await rater.rate(item.brief, await loadImage(dir, shot.image));
      const rating = { id: item.id, generator: shot.generator, judge: rater.id, version: rater.version, model, scores, total, at: now().toISOString() };
      await appendFile(file, `${JSON.stringify(rating)}\n`);
      inputTokens += spent;
      options.onRated?.(item, rating);
    }
  }
  return inputTokens;
}

/** The rater's latest scores per image, made under its current rubric. */
export function currentRatings(ratings: RatingRecord[], rater: Pick<ImageRater, "id" | "version">): Ratings {
  const current: Ratings = new Map();
  for (const rating of ratings.filter((r) => r.judge === rater.id && r.version === rater.version)) {
    current.set(rating.id, (current.get(rating.id) ?? new Map<string, RatingRecord>()).set(rating.generator, rating));
  }
  return current;
}

export const loadRatings = (file: string): Promise<RatingRecord[]> => loadJsonLines(file, parseRating);

function parseRating(row: Record<string, unknown>, where: string): RatingRecord {
  const field = (name: string) => `${where}: ${name}`;
  return {
    id: expectString(row.id, field("id")),
    generator: expectString(row.generator, field("generator")),
    judge: expectString(row.judge, field("judge")),
    version: expectString(row.version, field("version")),
    model: expectString(row.model, field("model")),
    scores: expectProbabilities(row.scores, field("scores")),
    total: expectProbability(row.total, field("total")),
    at: expectString(row.at, field("at")),
  };
}

export type RatingSummary = {
  /** Briefs with every image scored and picked. */
  briefs: number;
  /** Briefs whose top-scoring image came from the routed model, or the default. */
  topWas: { routed: number; default: number };
  /** Briefs where the top-scoring image is the one the picker chose. */
  agreesWithPick: number;
};

/** Ties go to neither: a shared top score doesn't say one image beat the rest. */
function topGenerator(byGenerator: Map<string, RatingRecord>): string | undefined {
  const [first, second] = [...byGenerator.values()].toSorted((a, b) => b.total - a.total);
  return first.total === second?.total ? undefined : first.generator;
}

export function summarizeRatings({ meta, items }: ShootoutManifest, ratings: Ratings, picks: Map<string, PickRecord>): RatingSummary {
  const rated = items.flatMap((item) => {
    const byGenerator = ratings.get(item.id);
    const pick = picks.get(item.id);
    return byGenerator?.size === item.shots.length && pick ? [{ item, pick, top: topGenerator(byGenerator) }] : [];
  });
  const count = (hit: (x: (typeof rated)[number]) => boolean) => rated.filter(hit).length;
  return {
    briefs: rated.length,
    topWas: { routed: count(({ item, top }) => top === meta.lineup[item.route.choice]), default: count(({ top }) => top === meta.defaultGenerator) },
    agreesWithPick: count(({ pick, top }) => top === pick.best),
  };
}
