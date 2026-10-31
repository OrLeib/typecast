import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDecisionResponse } from "../../src/jev/parse.ts";

// Recorded live from jev-1.14.0 for "Hero image for a spring sneaker campaign, studio lighting".
const fixture = JSON.parse(readFileSync(new URL("../fixtures/jev-choice-response.json", import.meta.url), "utf8"));
const clone = () => structuredClone(fixture);

describe("parseDecisionResponse", () => {
  it("parses the recorded response", () => {
    const r = parseDecisionResponse(fixture);
    expect(r.model).toBe("jev-1.14.0");
    expect(r.usage).toEqual({ input_tokens: 474, output_tokens: 69 });
    expect(r.answers.model.choice).toBe("product");
    expect(r.answers.model.confidence).toBe(0.98);
    expect(Object.keys(r.answers.model.probabilities)).toHaveLength(6);
  });

  it.each([
    ["non-object body", () => "oops", /response must be an object/],
    ["missing usage", () => ({ ...clone(), usage: undefined }), /usage must be an object/],
    ["missing model", () => ({ ...clone(), model: undefined }), /model must be a string/],
    ["answers at top level", () => { const { answers, ...rest } = clone(); return { ...rest, ...answers }; }, /answers must be an object/],
    ["non-choice answer", () => { const b = clone(); b.answers.model.type = "score"; return b; }, /answers\.model\.type must be "choice"/],
    ["choice outside options", () => { const b = clone(); b.answers.model.choice = "audio"; return b; }, /"audio" is not in probabilities/],
    ["non-numeric probability", () => { const b = clone(); b.answers.model.probabilities.video = "0"; return b; }, /probabilities\.video must be a number/],
  ])("rejects %s", (_name, body, message) => {
    expect(() => parseDecisionResponse(body())).toThrow(message);
  });
});
