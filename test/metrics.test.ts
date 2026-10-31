import { describe, expect, it } from "vitest";
import { accuracy, brier, confidentMisses, ece, logLoss, percentile, PROB_FLOOR } from "../src/metrics.ts";

describe("metrics", () => {
  it("accuracy", () => {
    expect(accuracy([
      { expected: "a", choice: "a", confidence: 0.9 },
      { expected: "a", choice: "b", confidence: 0.6 },
    ])).toBe(0.5);
  });

  it("ECE is 0 when confidence matches accuracy", () => {
    const preds = Array.from({ length: 10 }, (_, i) => ({ expected: "a", choice: i < 8 ? "a" : "b", confidence: 0.8 }));
    expect(ece(preds)).toBeCloseTo(0, 6);
  });

  it("ECE flags overconfidence", () => {
    const preds = Array.from({ length: 10 }, (_, i) => ({ expected: "a", choice: i < 5 ? "a" : "b", confidence: 0.95 }));
    expect(ece(preds)).toBeCloseTo(0.45, 6);
  });

  it("percentile", () => {
    expect(percentile([10, 20, 30, 40], 50)).toBe(20);
    expect(percentile([10, 20, 30, 40], 95)).toBe(40);
  });

  it("log-loss is -ln p(expected), clipped at the reporting floor", () => {
    const p = (expected: string, probabilities: Record<string, number>) => ({ expected, choice: "a", confidence: 0.9, probabilities });
    expect(logLoss([p("a", { a: 0.5, b: 0.5 })])).toBeCloseTo(Math.log(2), 6);
    expect(logLoss([p("b", { a: 1, b: 0 })])).toBeCloseTo(-Math.log(PROB_FLOOR), 6);
    expect(logLoss([p("c", { a: 1, b: 0 })])).toBeCloseTo(-Math.log(PROB_FLOOR), 6);
  });

  it("Brier is 0 for a perfect forecast and 2 for a fully confident wrong one", () => {
    expect(brier([{ expected: "a", choice: "a", confidence: 1, probabilities: { a: 1, b: 0 } }])).toBe(0);
    expect(brier([{ expected: "b", choice: "a", confidence: 1, probabilities: { a: 1, b: 0 } }])).toBe(2);
    expect(brier([{ expected: "a", choice: "a", confidence: 0.5, probabilities: { a: 0.5, b: 0.5 } }])).toBeCloseTo(0.5, 6);
  });

  it("confident misses count only wrong answers at or above the threshold", () => {
    expect(confidentMisses([
      { expected: "a", choice: "b", confidence: 0.85 },
      { expected: "a", choice: "b", confidence: 0.84 },
      { expected: "a", choice: "a", confidence: 0.99 },
    ])).toBe(1);
  });
});
