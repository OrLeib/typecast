import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ImageRater } from "../../src/judging/image-rater.ts";
import type { PickRecord } from "../../src/judging/picks.ts";
import { currentRatings, loadRatings, rateRun, RATINGS_FILE, summarizeRatings, type RatingRecord } from "../../src/judging/ratings.ts";
import { shootoutOf, writeShootoutImages } from "../support/level2-fixtures.ts";

const manifest = shootoutOf([{ id: "a", choice: "photo" }, { id: "b", choice: "illustration" }]);
const now = () => new Date("2026-11-04T12:00:00Z");
let dir = "";

/** Scores an image by its file's bytes, counting how many it scored. */
const rater = (version = "v1") => {
  const counted = { rated: 0 };
  const scorer: ImageRater = {
    id: "fake",
    version,
    async rate(_brief, image) {
      counted.rated++;
      const total = image.data.toString().endsWith("photo-gen") ? 0.8 : 0.4;
      return { scores: { Brief: total }, total, model: "fake-1", inputTokens: 10, latencyMs: 1 };
    },
  };
  return { scorer, counted };
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "typecast-ratings-"));
  await writeShootoutImages(dir, manifest);
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("rateRun", () => {
  it("scores every image, keeping a record that reads back", async () => {
    const { scorer } = rater();
    expect(await rateRun(scorer, dir, manifest, { now })).toBe(60);

    const ratings = currentRatings(await loadRatings(join(dir, RATINGS_FILE)), scorer);
    expect(ratings.get("a")?.get("photo-gen")).toEqual({ id: "a", generator: "photo-gen", judge: "fake", version: "v1", model: "fake-1", scores: { Brief: 0.8 }, total: 0.8, at: "2026-11-04T12:00:00.000Z" });
    expect(ratings.get("b")?.size).toBe(3);
  });

  it("resumes past images it scored, and scores again under a new rubric", async () => {
    const first = rater();
    await rateRun(first.scorer, dir, manifest);
    await rateRun(first.scorer, dir, manifest);
    expect(first.counted.rated).toBe(6);

    const changed = rater("v2");
    await rateRun(changed.scorer, dir, manifest);
    expect(changed.counted.rated).toBe(6);
  });

  it("names the file and field of a bad row", async () => {
    await writeFile(join(dir, RATINGS_FILE), `${JSON.stringify({ id: "a" })}\n`);
    await expect(loadRatings(join(dir, RATINGS_FILE))).rejects.toThrow(/ratings\.jsonl:1: generator/);
  });
});

describe("summarizeRatings", () => {
  const rating = (id: string, generator: string, total: number): RatingRecord => ({ id, generator, judge: "j", version: "v", model: "m", scores: { Brief: total }, total, at: "t" });
  const pick = (id: string, best: string): [string, PickRecord] => [id, { id, judge: "j", version: "v", model: "m", best, probabilities: {}, agreement: 1, at: "t" }];
  const scoresFor = (id: string, photo: number, draw: number, dflt: number) => [rating(id, "photo-gen", photo), rating(id, "draw-gen", draw), rating(id, "dflt", dflt)];
  const judge = { id: "j", version: "v" };

  it("counts where the top scores went and whether they matched the pick", () => {
    const ratings = currentRatings([...scoresFor("a", 0.9, 0.2, 0.1), ...scoresFor("b", 0.1, 0.2, 0.9)], judge);
    expect(summarizeRatings(manifest, ratings, new Map([pick("a", "photo-gen"), pick("b", "draw-gen")]))).toEqual({ briefs: 2, topWas: { routed: 1, default: 1 }, agreesWithPick: 1 });
  });

  it("leaves out a brief not fully scored, and credits no one with a tied top score", () => {
    const ratings = currentRatings([rating("a", "photo-gen", 0.9), ...scoresFor("b", 0.5, 0.5, 0.1)], judge);
    expect(summarizeRatings(manifest, ratings, new Map([pick("a", "photo-gen"), pick("b", "draw-gen")]))).toEqual({ briefs: 1, topWas: { routed: 0, default: 0 }, agreesWithPick: 0 });
  });
});
