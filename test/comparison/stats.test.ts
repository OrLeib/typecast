import { describe, expect, it } from "vitest";
import { bootstrapCI, mcnemarExact, rng } from "../../src/comparison/stats.ts";

describe("mcnemarExact", () => {
  it("matches the exact binomial two-sided p-value", () => {
    expect(mcnemarExact(0, 0)).toBe(1);
    expect(mcnemarExact(3, 3)).toBe(1);
    expect(mcnemarExact(0, 5)).toBeCloseTo(2 / 32, 10); // 2 * 0.5^5
    expect(mcnemarExact(1, 9)).toBeCloseTo((2 * 11) / 1024, 10); // 2 * (C(10,0)+C(10,1)) / 2^10
  });

  it("is symmetric", () => {
    expect(mcnemarExact(2, 8)).toBe(mcnemarExact(8, 2));
  });
});

describe("bootstrapCI", () => {
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

  it("is reproducible for a given seed", () => {
    const xs = Array.from({ length: 50 }, (_, i) => i % 7);
    expect(bootstrapCI(xs, mean, { seed: 3 })).toEqual(bootstrapCI(xs, mean, { seed: 3 }));
  });

  it("brackets the sample mean and collapses for constant data", () => {
    const xs = Array.from({ length: 100 }, (_, i) => (i < 30 ? 1 : 0));
    const [lo, hi] = bootstrapCI(xs, mean);
    expect(lo).toBeLessThan(0.3);
    expect(hi).toBeGreaterThan(0.3);
    expect(bootstrapCI([2, 2, 2], mean)).toEqual([2, 2]);
  });
});

describe("rng", () => {
  it("produces values in [0, 1)", () => {
    const r = rng(42);
    for (let i = 0; i < 1000; i++) {
      const x = r();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});
