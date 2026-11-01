import { describe, expect, it } from "vitest";
import { summarizePicks } from "../../src/judging/pick-summary.ts";
import type { PickRecord } from "../../src/judging/picks.ts";
import { shootoutOf } from "../support/level2-fixtures.ts";

const pick = (id: string, best: string, agreement = 1): PickRecord => ({
  id, judge: "j", version: "v", model: "m", best, agreement, at: "t",
  probabilities: { "photo-gen": 0.2, "draw-gen": 0.2, dflt: 0.2, [best]: 0.6 },
});

describe("summarizePicks", () => {
  const manifest = shootoutOf([
    { id: "a", choice: "photo" },
    { id: "b", choice: "illustration" },
    { id: "c", choice: "illustration", expected: "illustration" },
    { id: "d", choice: "photo" },
  ]);
  const summary = summarizePicks(manifest, new Map([
    ["a", pick("a", "photo-gen")],
    ["b", pick("b", "photo-gen", 0.5)],
    ["c", pick("c", "dflt")],
  ]));

  it("scores how often the routed, expected and default models made the best image", () => {
    expect(summary).toMatchObject({ picked: 3, unpicked: 1, models: 3 });
    expect(summary.bestWas.routed).toBeCloseTo(1 / 3);
    expect(summary.bestWas.expected).toBeCloseTo(2 / 3);
    expect(summary.bestWas.default).toBeCloseTo(1 / 3);
  });

  it("averages agreement and the picked image's probability", () => {
    expect(summary.meanAgreement).toBeCloseTo(2.5 / 3);
    expect(summary.meanTopProbability).toBeCloseTo(0.6);
  });

  it("counts picks per model", () => {
    expect(summary.byGenerator["photo-gen"].picked).toBe(2);
    expect(summary.byGenerator["draw-gen"].picked).toBe(0);
    expect(summary.byGenerator["draw-gen"].meanProbability).toBeCloseTo(0.2);
  });
});
