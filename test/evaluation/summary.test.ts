import { describe, expect, it } from "vitest";
import type { Brief } from "../../src/evaluation/briefs.ts";
import { formatMisses } from "../../src/evaluation/report.ts";
import type { Result } from "../../src/evaluation/result.ts";
import { RUN_METRICS } from "../../src/evaluation/run-metrics.ts";
import { summarize } from "../../src/evaluation/summary.ts";

const briefs: Brief[] = [
  { id: "a", brief: "clear one", expected: "x" },
  { id: "b", brief: "borderline one", expected: "x", note: "why" },
];
const result = (id: string, repeat: number, choice: string): Result => ({
  id, repeat, expected: "x", choice, confidence: 0.9, probabilities: { x: choice === "x" ? 0.9 : 0.1, y: choice === "x" ? 0.1 : 0.9 },
  latencyMs: 100 * (repeat + 1), inputTokens: 500, model: "jev-test",
});
const results = [result("a", 0, "x"), result("b", 0, "y"), result("a", 1, "x"), result("b", 1, "x")];
const meta = { data: "d.jsonl", variant: "baseline", repeats: 2, commit: "abc" };

describe("summarize", () => {
  const s = summarize(results, briefs, meta, 0.042);

  it("keeps the run metadata and computes every registered metric", () => {
    expect(s).toMatchObject({ ...meta, n: 2, model: "jev-test" });
    expect(Object.keys(s.metrics)).toEqual(RUN_METRICS.map((m) => m.id));
  });

  it("splits accuracy by repeat and by clear vs borderline", () => {
    expect(s.perRepeatAccuracy).toEqual([0.5, 1]);
    expect(s.metrics.accuracyClear).toBe(1);
    expect(s.metrics.accuracyBorderline).toBe(0.5);
    expect(s.metrics.confidentMissesPerRepeat).toBe(0.5);
  });

  it("prices routes from mean input tokens", () => {
    expect(s.costPer1000Usd).toBeCloseTo(500 * 1000 * (0.042 / 1e6), 10);
  });
});

describe("formatMisses", () => {
  it("lists each miss with the expected option's probability and the runner-up", () => {
    expect(formatMisses(results)).toEqual(["  miss b#0: expected x (0.10), got y (0.90), runner-up x"]);
  });
});
