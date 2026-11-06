import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadShootoutEvidence } from "../../src/demo/shootout-evidence.ts";
import { saveManifest, SHOOTOUT_FILE } from "../../src/generation/manifest.ts";
import { PICKS_FILE, type PickRecord } from "../../src/judging/picks.ts";
import { RATINGS_FILE } from "../../src/judging/ratings.ts";
import { shootoutOf } from "../support/level2-fixtures.ts";

const dir = await mkdtemp(join(tmpdir(), "typecast-shootout-evidence-"));
afterAll(() => rm(dir, { recursive: true, force: true }));
const judge = { id: "jev", version: "v1" };

const pick = (id: string, best: string, version = "v1", agreement = 0.8): PickRecord => ({
  id, judge: "jev", version, model: "m", best, agreement, at: "t", probabilities: { "photo-gen": 0.6, "draw-gen": 0.3, dflt: 0.1 },
});

async function run(name: string, picks: PickRecord[]) {
  await mkdir(join(dir, name));
  await saveManifest(join(dir, name), shootoutOf([{ id: "a", choice: "photo" }, { id: "b", choice: "illustration" }]), SHOOTOUT_FILE);
  for (const p of picks) await appendFile(join(dir, name, PICKS_FILE), `${JSON.stringify(p)}\n`);
}

describe("loadShootoutEvidence", () => {
  it("shows the newest run this judge picked, only its picked briefs, and serves only that run's images", async () => {
    await run("2026-11-01T10", [pick("a", "draw-gen")]);
    await run("2026-11-01T11", [pick("a", "photo-gen"), pick("b", "dflt", "v1", 0.4)]);
    await run("2026-11-01T12", [pick("a", "photo-gen", "old-prompt")]);
    await run("2026-11-01T13", []);

    const { evidence, files } = (await loadShootoutEvidence(dir, judge, judge))!;
    expect(evidence).toMatchObject({ run: "2026-11-01T11", picked: 2, models: 3, defaultGenerator: "dflt", bestWas: { routed: 0.5, default: 0.5 } });
    const [a, b] = evidence.briefs;
    expect(a).toMatchObject({ id: "a", brief: "brief <a>", routed: "photo", routedGenerator: "photo-gen", agreement: 0.8, split: false });
    expect(b).toMatchObject({ id: "b", agreement: 0.4, split: true });
    expect(a.shots[0]).toEqual({ generator: "photo-gen", url: "/shootout-images/a-photo-gen.png", probability: 0.6, picked: true });
    expect(files.get("/shootout-images/a-photo-gen.png")).toBe(join(dir, "2026-11-01T11", "images", "a-photo-gen.png"));
    expect(files.size).toBe(6);
  });

  it("adds the rubric's scores to their shots, and how they stand against the picks, only for this rubric", async () => {
    await run("2026-11-02T10", [pick("a", "photo-gen"), pick("b", "dflt")]);
    const ratings = ["photo-gen", "draw-gen", "dflt"].map((generator, i) => ({ id: "a", generator, judge: "jev", version: "v1", model: "m", scores: { Brief: 0.9 - i / 10 }, total: 0.9 - i / 10, at: "t" }));
    const stale = { ...ratings[0], id: "b", version: "old-rubric" };
    await writeFile(join(dir, "2026-11-02T10", RATINGS_FILE), [...ratings, stale].map((m) => JSON.stringify(m)).join("\n"));

    const { evidence } = (await loadShootoutEvidence(dir, judge, judge))!;
    expect(evidence.briefs[0].shots[1].rating).toEqual({ scores: { Brief: 0.8 }, total: 0.8 });
    expect(evidence.briefs[1].shots[0].rating).toBeUndefined();
    expect(evidence.rubric).toEqual({ briefs: 1, topWas: { routed: 1, default: 0 }, agreesWithPick: 1 });
  });

  it("returns nothing when there is no shootout directory", async () => {
    expect(await loadShootoutEvidence(join(dir, "missing"), judge, judge)).toBeUndefined();
  });
});
