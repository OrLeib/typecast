import { describe, expect, it } from "vitest";
import { blindOrder, routedSide } from "../../src/judging/blind.ts";

const ids = Array.from({ length: 200 }, (_, i) => `b${String(i).padStart(3, "0")}`);

describe("routedSide", () => {
  it("is stable for a pair and splits pairs roughly evenly between sides", () => {
    expect(routedSide("b001")).toBe(routedSide("b001"));
    const left = ids.filter((id) => routedSide(id) === "left").length;
    expect(left).toBeGreaterThan(70);
    expect(left).toBeLessThan(130);
  });
});

describe("blindOrder", () => {
  it("is a fixed permutation that breaks up file order", () => {
    const items = ids.map((id) => ({ id }));
    const order = blindOrder(items).map((x) => x.id);
    expect(order).toEqual(blindOrder(items).map((x) => x.id));
    expect([...order].sort()).toEqual(ids);
    expect(order).not.toEqual(ids);
  });
});
