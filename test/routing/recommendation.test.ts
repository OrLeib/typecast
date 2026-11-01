import { describe, expect, it } from "vitest";
import { PICK_THRESHOLD, recommend } from "../../src/routing/recommendation.ts";

describe("recommend", () => {
  it("picks one model at or above the threshold", () => {
    expect(recommend({ choice: "a", confidence: PICK_THRESHOLD, probabilities: { a: 0.85, b: 0.15 } })).toEqual({ mode: "pick", shortlist: ["a"] });
  });

  it("shortlists the top two below the threshold", () => {
    expect(recommend({ choice: "a", confidence: 0.6, probabilities: { c: 0.1, a: 0.6, b: 0.3 } })).toEqual({ mode: "compare", shortlist: ["a", "b"] });
  });

  it("picks when there is no runner-up to compare", () => {
    expect(recommend({ choice: "a", confidence: 0.5, probabilities: { a: 0.5 } })).toEqual({ mode: "pick", shortlist: ["a"] });
  });
});
