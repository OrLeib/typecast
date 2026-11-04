import { describe, expect, it } from "vitest";
import { explain, YES_AT, type Reason } from "../../src/routing/reasons.ts";
import type { Recommendation } from "../../src/routing/recommendation.ts";

const reason = (category: string, probability: number): Reason => ({ category, label: `${category} label`, probability });

describe("explain", () => {
  const pick: Recommendation = { mode: "pick", shortlist: ["type"] };

  it("puts the reason that decided a pick first, then whatever else also holds", () => {
    const route = { choice: "type", reasons: [reason("draw", 0.9), reason("type", 0.95), reason("video", 0.1)] };
    expect(explain(route, pick)).toEqual({ because: [reason("type", 0.95), reason("draw", 0.9)], open: [] });
  });

  it("says nothing when the pick's own check doesn't back it, rather than offer a reason for another category", () => {
    const route = { choice: "type", reasons: [reason("draw", 0.9), reason("type", YES_AT - 0.01)] };
    expect(explain(route, pick)).toEqual({ because: [], open: [] });
  });

  it("gives an unsure route both candidates' reasons, in shortlist order", () => {
    const route = { choice: "type", reasons: [reason("draw", 0.6), reason("video", 0.1), reason("type", 0.5)] };
    expect(explain(route, { mode: "compare", shortlist: ["type", "draw"] })).toEqual({ because: [], open: [reason("type", 0.5), reason("draw", 0.6)] });
  });

  it("explains nothing for a router with no checks", () => {
    expect(explain({ choice: "type", reasons: [] }, pick)).toEqual({ because: [], open: [] });
  });
});
