import { describe, expect, it } from "vitest";
import { compareRuns, verdict, type MetricDelta } from "../../src/comparison/compare.ts";
import type { Result } from "../../src/evaluation/result.ts";
import { RUN_METRICS } from "../../src/evaluation/run-metrics.ts";

const result = (id: string, choice: string, expected: string, repeat = 0, confidence = 0.9): Result => ({
  id, repeat, expected, choice, confidence,
  probabilities: { [choice]: confidence, ...(choice === expected ? {} : { [expected]: 1 - confidence }) },
  latencyMs: 100, inputTokens: 500, model: "jev-test",
});

describe("compareRuns", () => {
  it("reports zero deltas and no flips for identical runs", () => {
    const run = [result("a", "x", "x"), result("b", "y", "x")];
    const c = compareRuns(run, run, { borderline: new Set(["b"]) });
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
    const c = compareRuns(a, b, { borderline: new Set(["fixed"]) });
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

  it("counts a brief with no majority choice as wrong, even when the expected option sorts first", () => {
    const split = [result("t", "a", "a", 0), result("t", "b", "a", 1), result("t", "c", "a", 2)];
    const right = [result("t", "a", "a", 0), result("t", "a", "a", 1), result("t", "a", "a", 2)];
    const c = compareRuns(split, right, { borderline: new Set() });
    expect(c.mcnemar).toMatchObject({ onlyA: 0, onlyB: 1 });
    expect(c.flips).toEqual([{ id: "t", expected: "a", a: undefined, b: "a" }]);
  });

  it("reports an undefined subset metric as NaN rather than 0", () => {
    const run = [result("a", "x", "x")];
    const borderline = compareRuns(run, run, { borderline: new Set() }).metrics.find((m) => m.metric === "accuracy (borderline)")!;
    expect(borderline).toMatchObject({ a: NaN, b: NaN, ci: [NaN, NaN] });
  });

  it("refuses runs over different briefs", () => {
    expect(() => compareRuns([result("a", "x", "x")], [result("b", "x", "x")], { borderline: new Set() })).toThrow(/different briefs/);
  });

  it("reports one delta per registered run metric", () => {
    const run = [result("a", "x", "x")];
    expect(compareRuns(run, run, { borderline: new Set() }).metrics.map((m) => m.metric)).toEqual(RUN_METRICS.map((m) => m.label));
  });
});

describe("verdict", () => {
  const delta = (ci: [number, number], lowerIsBetter: boolean): MetricDelta => ({ metric: "m", a: 0, b: 0, delta: 0, ci, lowerIsBetter });

  it("calls a change only when the whole CI is on one side of zero", () => {
    expect(verdict(delta([0.01, 0.05], false))).toBe("better");
    expect(verdict(delta([0.01, 0.05], true))).toBe("worse");
    expect(verdict(delta([-0.05, -0.01], true))).toBe("better");
    expect(verdict(delta([-0.01, 0.01], false))).toBe("unclear");
  });
});
