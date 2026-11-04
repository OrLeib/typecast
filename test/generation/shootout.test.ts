import { describe, expect, it } from "vitest";
import type { Brief } from "../../src/evaluation/briefs.ts";
import { runShootout, type ShootoutItem } from "../../src/generation/shootout.ts";
import type { Router } from "../../src/routing/router.ts";
import { createFakeGenerator } from "../support/fake-generator.ts";

const router: Router = {
  async route() {
    return { choice: "photo", confidence: 0.7, probabilities: { photo: 0.7 }, reasons: [], model: "fake-1", inputTokens: 1, latencyMs: 1 };
  },
};

const brief = (id: string): Brief => ({ id, brief: `prompt ${id}`, expected: "photo" });

describe("runShootout", () => {
  it("routes each brief and renders it with every generator, same prompt and seed", async () => {
    const generators = [createFakeGenerator("gen-a", 10), createFakeGenerator("gen-b", 20)];
    const [item] = await runShootout(router, generators, [brief("b1")], { dir: "runs/s", seed: 3 });

    for (const g of generators) expect(g.requests).toEqual([{ prompt: "prompt b1", seed: 3, outputPath: `runs/s/images/b1-${g.name}.png` }]);
    expect(item).toEqual({
      id: "b1", brief: "prompt b1", expected: "photo", route: { choice: "photo", confidence: 0.7, model: "fake-1" },
      shots: [{ generator: "gen-a", image: "images/b1-gen-a.png", latencyMs: 10 }, { generator: "gen-b", image: "images/b1-gen-b.png", latencyMs: 20 }],
    });
  });

  it("keeps items from an interrupted run instead of rendering them again", async () => {
    const generator = createFakeGenerator("gen-a");
    const saved: ShootoutItem = { id: "b1", brief: "prompt b1", expected: "photo", route: { choice: "x", confidence: 1, model: "m" }, shots: [] };
    const seen: string[] = [];
    const items = await runShootout(router, [generator], [brief("b1"), brief("b2")], {
      dir: "d", seed: 1, previous: new Map([["b1", saved]]), onItem: (item) => void seen.push(item.id),
    });
    expect(items[0]).toBe(saved);
    expect(generator.requests.map((r) => r.prompt)).toEqual(["prompt b2"]);
    expect(seen).toEqual(["b1", "b2"]);
  });
});
