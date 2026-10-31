import { describe, expect, it } from "vitest";
import { createKeywordRouter, KEYWORD_ROUTER_MODEL } from "../../src/routing/keyword-router.ts";
import { ROSTER } from "../../src/routing/roster.ts";

const router = createKeywordRouter(Object.keys(ROSTER));

describe("createKeywordRouter", () => {
  it.each([
    ["5-second loop of a poster saying 'HI'", "video"],
    ["rough poster saying 'HI'", "fast-draft"],
    ["poster with the title 'HI' in watercolor", "typography"],
    ["watercolor fox on a studio backdrop", "illustration"],
    ["perfume bottle on a white background", "product"],
    ["candid portrait in a café", "photoreal"],
    ["a quiet lake", "photoreal"],
  ])("routes %j to %s by the first matching rule in priority order", async (brief, expected) => {
    expect((await router.route(brief)).choice).toBe(expected);
  });

  it("returns a one-hot, fully confident, free route over the whole roster", async () => {
    const r = await router.route("a quiet lake");
    expect(Object.keys(r.probabilities).sort()).toEqual(Object.keys(ROSTER).sort());
    expect(Object.values(r.probabilities).reduce((s, p) => s + p, 0)).toBe(1);
    expect(r).toMatchObject({ confidence: 1, inputTokens: 0, model: KEYWORD_ROUTER_MODEL });
  });

  it("refuses rules for categories outside the roster", () => {
    expect(() => createKeywordRouter(["photoreal"])).toThrow(/not in the roster/);
  });
});
