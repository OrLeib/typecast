import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { bakeStories, loadHomeStories, loadStoryPlan } from "../../src/demo/home-stories.ts";
import type { LoadedShootout, ShootoutBrief } from "../../src/demo/shootout-evidence.ts";

const BOX = { top: 0.1, bottom: 0.5, left: 0.2, right: 0.6 };
const PLAN = [{ id: "sure", label: "Sure", target: "the shoe" }, { id: "unsure", label: "Unsure", target: "the logo" }];

function brief(id: string, confidence: number): ShootoutBrief {
  const shot = (generator: string, picked: boolean) => ({ generator, url: `/${id}-${generator}`, probability: picked ? 0.8 : 0.2, picked });
  return { id, brief: `brief ${id}`, expected: "photo", routed: "photo", confidence, routedGenerator: "photo-model", agreement: 1, split: false, shots: [shot("photo-model", false), shot("draw-model", true)] };
}

const shootout = async (): Promise<Pick<LoadedShootout, "dir" | "evidence" | "files">> => ({
  dir: await mkdtemp(join(tmpdir(), "stories-")),
  evidence: { run: "r", data: "d", defaultGenerator: "photo-model", lineup: { photo: "photo-model", draw: "draw-model" }, picked: 2, models: 2, meanAgreement: 1, bestWas: { routed: 0, expected: 0, default: 0 }, briefs: [brief("sure", 0.95), brief("unsure", 0.5)] },
  files: new Map([["/sure-draw-model", "sure.png"], ["/unsure-draw-model", "unsure.png"]]),
});

const deps = () => ({
  locator: { locate: vi.fn(async (_image: Buffer, _target: string) => ({ box: BOX, confidence: 0.9, presence: 0.9, model: "m", inputTokens: 1, latencyMs: 1 })) },
  router: { route: vi.fn(async () => ({ choice: "photo", confidence: 0.5, probabilities: { photo: 0.5, draw: 0.3, video: 0.2 }, reasons: [], model: "m", latencyMs: 1, inputTokens: 1, outputTokens: 1 })) },
  readImage: async (path: string) => Buffer.from(path),
});

describe("bakeStories", () => {
  it("boxes each brief's best image and routes it again", async () => {
    const run = await shootout();
    const baked = deps();
    await bakeStories(PLAN, run, baked);
    expect(baked.locator.locate.mock.calls.map(([image, target]) => [image.toString(), target])).toEqual([["sure.png", "the shoe"], ["unsure.png", "the logo"]]);
    expect(baked.router.route.mock.calls).toEqual([["brief sure"], ["brief unsure"]]);
  });

  it("asks nothing again for answers it already has, and again when a target changes", async () => {
    const run = await shootout();
    await bakeStories(PLAN, run, deps());
    const again = deps();
    await bakeStories(PLAN, run, again);
    expect(again.locator.locate).not.toHaveBeenCalled();
    await bakeStories([{ ...PLAN[0], target: "the lace" }], run, again);
    expect(again.locator.locate).toHaveBeenCalledTimes(1);
  });

  it("refuses a route that no longer matches the images", async () => {
    const changed = deps();
    changed.router.route.mockResolvedValueOnce({ ...(await deps().router.route()), choice: "draw" });
    await expect(bakeStories(PLAN, await shootout(), changed)).rejects.toThrow("sure now routes to draw, not photo");
  });

  it("names a planned brief the shootout doesn't have", async () => {
    await expect(bakeStories([{ id: "gone", label: "Gone", target: "x" }], await shootout(), deps())).rejects.toThrow("gone");
  });
});

describe("loadHomeStories", () => {
  const planFile = async (dir: string) => {
    const file = join(dir, "plan.json");
    await writeFile(file, JSON.stringify(PLAN));
    return file;
  };

  it("joins the plan to the shootout, in the plan's order, with the runner-up's image for an unsure route", async () => {
    const run = await shootout();
    await bakeStories(PLAN, run, deps());
    const [sure, unsure] = await loadHomeStories(run, await planFile(run.dir));
    expect(sure.label).toBe("Sure");
    expect(sure.box).toEqual(BOX);
    expect(sure.best.generator).toBe("draw-model");
    expect(sure.routed?.generator).toBe("photo-model");
    expect(unsure.second?.generator).toBe("draw-model");
    expect(unsure.confidence).toBe(0.5);
    expect(unsure.explanation).toEqual({ because: [], open: [] });
  });

  it("leaves out a brief whose answer is for another target", async () => {
    const run = await shootout();
    await bakeStories(PLAN, run, deps());
    const file = await planFile(run.dir);
    await writeFile(file, JSON.stringify([{ ...PLAN[0], target: "something else" }, PLAN[1]]));
    expect((await loadHomeStories(run, file)).map((story) => story.label)).toEqual(["Unsure"]);
  });

  it("is empty with no shootout, so the page still loads on a fresh clone", async () => {
    expect(await loadHomeStories(undefined)).toEqual([]);
  });
});

describe("loadStoryPlan", () => {
  it("names the offending field", async () => {
    const run = await shootout();
    const file = join(run.dir, "plan.json");
    await writeFile(file, JSON.stringify([{ id: "a", label: "A" }]));
    await expect(loadStoryPlan(file)).rejects.toThrow("target");
    expect(await readFile(file, "utf8")).toContain("A");
  });

  it("accepts the committed plan", async () => {
    expect((await loadStoryPlan("data/home-briefs.json")).length).toBeGreaterThan(0);
  });
});
