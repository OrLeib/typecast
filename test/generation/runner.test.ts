import { describe, expect, it } from "vitest";
import type { Brief } from "../../src/evaluation/briefs.ts";
import { runGeneration, type GenerationItem } from "../../src/generation/runner.ts";
import type { Router } from "../../src/routing/router.ts";
import { createFakeGenerator } from "../support/fake-generator.ts";

const routeTo = (choices: Record<string, string>): Router => ({
  async route(brief) {
    const choice = choices[brief] ?? "photo";
    return { choice, confidence: 0.9, probabilities: { [choice]: 0.9 }, model: "fake-1", inputTokens: 1, latencyMs: 1 };
  },
});

const brief = (id: string): Brief => ({ id, brief: id, expected: "photo" });

describe("runGeneration", () => {
  it("renders each brief with the routed generator and the default one, under the run's images dir", async () => {
    const photo = createFakeGenerator("photo-model", 3000);
    const fallback = createFakeGenerator("default-model", 9000);
    const [item] = await runGeneration(routeTo({}), { byCategory: { photo }, fallback }, [brief("b1")], { dir: "runs/x", seed: 4 });

    expect(photo.requests).toEqual([{ prompt: "b1", seed: 4, outputPath: "runs/x/images/b1-photo-model.png" }]);
    expect(fallback.requests).toEqual([{ prompt: "b1", seed: 4, outputPath: "runs/x/images/b1-default-model.png" }]);
    expect(item).toEqual({
      id: "b1", brief: "b1", expected: "photo",
      route: { choice: "photo", confidence: 0.9, model: "fake-1" },
      routed: { generator: "photo-model", image: "images/b1-photo-model.png", latencyMs: 3000 },
      default: { generator: "default-model", image: "images/b1-default-model.png", latencyMs: 9000 },
    });
  });

  it("renders once when routing picks the default model itself", async () => {
    const fallback = createFakeGenerator("default-model");
    const [item] = await runGeneration(routeTo({}), { byCategory: { photo: fallback }, fallback }, [brief("b1")], { dir: "d", seed: 1 });
    expect(fallback.requests).toHaveLength(1);
    expect(item).toMatchObject({ routed: { generator: "default-model" }, default: { generator: "default-model" } });
  });

  it("skips a brief routed to a category with no generator", async () => {
    const fallback = createFakeGenerator("default-model");
    const [item] = await runGeneration(routeTo({ b1: "video" }), { byCategory: {}, fallback }, [brief("b1")], { dir: "d", seed: 1 });
    expect(fallback.requests).toHaveLength(0);
    expect(item).toMatchObject({ id: "b1", skipped: 'no generator for category "video"' });
  });

  it("keeps items from an interrupted run instead of routing or rendering them again", async () => {
    const fallback = createFakeGenerator("default-model");
    const saved = { id: "b1", brief: "b1", expected: "photo", route: { choice: "video", confidence: 1, model: "m" }, skipped: "earlier" } satisfies GenerationItem;
    const seen: string[] = [];
    const items = await runGeneration(routeTo({}), { byCategory: { photo: fallback }, fallback }, [brief("b1"), brief("b2")], {
      dir: "d", seed: 1, previous: new Map([["b1", saved]]), onItem: (item) => void seen.push(item.id),
    });
    expect(items[0]).toBe(saved);
    expect(fallback.requests.map((r) => r.prompt)).toEqual(["b2"]);
    expect(seen).toEqual(["b1", "b2"]);
  });
});
