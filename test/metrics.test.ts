import { describe, expect, it } from "vitest";
import { accuracy, ece, percentile } from "../src/metrics.ts";

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
});
