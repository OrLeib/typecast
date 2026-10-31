import { describe, expect, it } from "vitest";
import { compareRuns } from "../src/comparison.ts";
import type { Result } from "../src/runs.ts";

const result = (id: string, choice: string, expected: string, repeat = 0, confidence = 0.9): Result => ({
  id, repeat, expected, choice, confidence,
  probabilities: { [choice]: confidence, ...(choice === expected ? {} : { [expected]: 1 - confidence }) },
  latencyMs: 100, inputTokens: 500, model: "jev-test",
});

describe("compareRuns", () => {
  it("reports zero deltas and no flips for identical runs", () => {
    const run = [result("a", "x", "x"), result("b", "y", "x")];
    const c = compareRuns(run, run, new Set());
    expect(c.flips).toEqual([]);
    expect(c.mcnemar).toEqual({ onlyA: 0, onlyB: 0, p: 1 });
    for (const m of c.metrics) {
      expect(m.delta).toBe(0);
      expect(m.ci).toEqual([0, 0]);
    }
  });

  it("counts discordant briefs by majority vote across repeats", () => {
    const a = [
      result("fixed", "y", "x", 0), result("fixed", "y", "x", 1), result("fixed", "x", "x", 2),
      result("broken", "x", "x", 0), result("broken", "x", "x", 1), result("broken", "x", "x", 2),
    ];
    const b = [
      result("fixed", "x", "x", 0), result("fixed", "x", "x", 1), result("fixed", "y", "x", 2),
      result("broken", "z", "x", 0), result("broken", "z", "x", 1), result("broken", "x", "x", 2),
    ];
    const c = compareRuns(a, b, new Set(["fixed"]));
    expect(c.mcnemar.onlyA).toBe(1);
    expect(c.mcnemar.onlyB).toBe(1);
    expect(c.flips).toEqual([
      { id: "broken", expected: "x", a: "x", b: "z" },
      { id: "fixed", expected: "x", a: "y", b: "x" },
    ]);
    const borderline = c.metrics.find((m) => m.metric === "accuracy (borderline)")!;
    expect(borderline.a).toBeCloseTo(1 / 3, 6);
    expect(borderline.b).toBeCloseTo(2 / 3, 6);
  });

  it("refuses runs over different briefs", () => {
    expect(() => compareRuns([result("a", "x", "x")], [result("b", "x", "x")], new Set())).toThrow(/different briefs/);
  });
});
