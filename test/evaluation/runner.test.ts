import { describe, expect, it } from "vitest";
import type { Brief } from "../../src/evaluation/briefs.ts";
import { runEval } from "../../src/evaluation/runner.ts";
import type { Router } from "../../src/routing/router.ts";

const briefs: Brief[] = [
  { id: "a", brief: "a clip", expected: "video" },
  { id: "b", brief: "a poster", expected: "typography" },
];
const router: Router = {
  route: async (brief) => ({
    type: "choice", choice: brief.includes("clip") ? "video" : "product", confidence: 0.7,
    probabilities: { video: 0.7, product: 0.3 }, model: "m", inputTokens: 10, latencyMs: 5,
  }),
};

describe("runEval", () => {
  it("routes every brief once per repeat, in order, and reports each result", async () => {
    const seen: string[] = [];
    const results = await runEval(router, briefs, 2, (r) => seen.push(`${r.id}#${r.repeat}`));
    expect(seen).toEqual(["a#0", "b#0", "a#1", "b#1"]);
    expect(results[1]).toEqual({
      id: "b", repeat: 0, expected: "typography", choice: "product", confidence: 0.7,
      probabilities: { video: 0.7, product: 0.3 }, latencyMs: 5, inputTokens: 10, model: "m",
    });
  });
});
