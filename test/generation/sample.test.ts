import { describe, expect, it } from "vitest";
import type { Brief } from "../../src/evaluation/briefs.ts";
import { selectSample } from "../../src/generation/sample.ts";

const briefs: Brief[] = ["a", "b", "c"].flatMap((category) =>
  Array.from({ length: 5 }, (_, i) => ({ id: `${category}${i}`, brief: `brief ${category}${i}`, expected: category })));

describe("selectSample", () => {
  it("takes the same number of briefs from each listed category, in file order", () => {
    const sample = selectSample(briefs, { perCategory: 2, categories: ["a", "c"], seed: 1 });
    expect(sample.map((b) => b.expected)).toEqual(["a", "a", "c", "c"]);
    expect(sample.map((b) => b.id)).toEqual([...sample.map((b) => b.id)].sort());
  });

  it("is fixed by the seed", () => {
    const pick = (seed: number) => selectSample(briefs, { perCategory: 2, categories: ["a", "b", "c"], seed }).map((b) => b.id);
    expect(pick(1)).toEqual(pick(1));
    expect([1, 2, 3, 4, 5].map((s) => pick(s).join()).some((ids) => ids !== pick(1).join())).toBe(true);
  });

  it("refuses a category with too few briefs", () => {
    expect(() => selectSample(briefs, { perCategory: 6, categories: ["a"], seed: 1 })).toThrow(/Only 5 "a" briefs, need 6/);
  });
});
