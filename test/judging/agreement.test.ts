import { describe, expect, it } from "vitest";
import { agreement } from "../../src/judging/agreement.ts";
import type { Judgment, Winner } from "../../src/judging/judgments.ts";

const judge = (name: string, winners: Record<string, Winner>) =>
  new Map(Object.entries(winners).map(([id, winner]): [string, Judgment] => [id, { id, winner, judge: name, at: "t" }]));

describe("agreement", () => {
  it("compares only pairs both judged, and counts routed-vs-default flips as opposite", () => {
    const human = judge("human", { a: "routed", b: "default", c: "tie", d: "routed", only: "routed" });
    const jev = judge("jev", { a: "routed", b: "routed", c: "default", d: "routed", other: "tie" });
    expect(agreement(human, jev)).toEqual({ n: 4, agree: 2, opposite: 1, rate: 0.5 });
  });

  it("has no rate when no pair was judged by both", () => {
    expect(agreement(judge("human", { a: "tie" }), judge("jev", { b: "tie" })).rate).toBeNaN();
  });
});
