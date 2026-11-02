import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDecisionResponse } from "../../src/jev/parse.ts";

// Recorded live from jev-1.14.0 for "Hero image for a spring sneaker campaign, studio lighting".
const fixture = JSON.parse(readFileSync(new URL("../fixtures/jev-choice-response.json", import.meta.url), "utf8"));
const clone = () => structuredClone(fixture);
// Recorded live from jev-1.14.0: the person's face in a full-body photo, and whether a face is visible.
const boxFixture = JSON.parse(readFileSync(new URL("../fixtures/jev-box-response.json", import.meta.url), "utf8"));
const cloneBox = () => structuredClone(boxFixture);

describe("parseDecisionResponse", () => {
  it("parses the recorded response", () => {
    const r = parseDecisionResponse(fixture);
    expect(r.model).toBe("jev-1.14.0");
    expect(r.usage).toEqual({ input_tokens: 474, output_tokens: 69 });
    expect(r.answers.model).toMatchObject({ type: "choice", choice: "product", confidence: 0.98 });
    expect(Object.keys((r.answers.model as { probabilities: object }).probabilities)).toHaveLength(6);
  });

  it("parses the recorded box and noul response", () => {
    const r = parseDecisionResponse(boxFixture);
    expect(r.answers.face).toEqual({ type: "box", box: { top: 0.22, bottom: 0.33, left: 0.51, right: 0.63 }, confidence: 0.87 });
    expect(r.answers.present).toEqual({ type: "noul", noul: 0.97 });
    expect(r.usage).toEqual({ input_tokens: 3706, output_tokens: 36 });
  });

  it.each([
    ["box edge outside the image", () => { const b = cloneBox(); b.answers.face.box.right = 1.2; return b; }, /answers\.face\.box\.right must be between 0 and 1, got 1\.2/],
    ["box with crossed edges", () => { const b = cloneBox(); b.answers.face.box.left = 0.7; return b; }, /left \(0\.7\) must be less than right \(0\.63\)/],
    ["box without confidence", () => { const b = cloneBox(); delete b.answers.face.confidence; return b; }, /answers\.face\.confidence must be a number/],
    ["noul above 1", () => { const b = cloneBox(); b.answers.present.noul = 1.5; return b; }, /answers\.present\.noul must be between 0 and 1/],
  ])("rejects a %s", (_name, body, message) => {
    expect(() => parseDecisionResponse(body())).toThrow(message);
  });

  it.each([
    ["non-object body", () => "oops", /response must be an object/],
    ["missing usage", () => ({ ...clone(), usage: undefined }), /usage must be an object/],
    ["missing model", () => ({ ...clone(), model: undefined }), /model must be a string/],
    ["answers at top level", () => { const { answers, ...rest } = clone(); return { ...rest, ...answers }; }, /answers must be an object/],
    ["unknown answer type", () => { const b = clone(); b.answers.model.type = "score"; return b; }, /answers\.model\.type must be "choice", "box" or "noul", got "score"/],
    ["choice outside options", () => { const b = clone(); b.answers.model.choice = "audio"; return b; }, /"audio" is not in probabilities/],
    ["non-numeric probability", () => { const b = clone(); b.answers.model.probabilities.video = "0"; return b; }, /probabilities\.video must be a number/],
    ["probability above 1", () => { const b = clone(); b.answers.model.probabilities.video = 1.2; return b; }, /probabilities\.video must be between 0 and 1, got 1\.2/],
    ["negative confidence", () => { const b = clone(); b.answers.model.confidence = -0.1; return b; }, /confidence must be between 0 and 1/],
  ])("rejects %s",(_name, body, message) => {
    expect(() => parseDecisionResponse(body())).toThrow(message);
  });
});
