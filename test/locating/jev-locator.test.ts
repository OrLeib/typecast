import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { DecisionClient } from "../../src/jev/client.ts";
import type { BoxAnswer } from "../../src/jev/parse.ts";
import { createJevLocator } from "../../src/locating/locator.ts";
import { createFakeDecisionClient, FAKE_SIGHT } from "../support/fake-decision-client.ts";
import { locatorContract, testImage } from "./locator.contract.ts";

const FACE: BoxAnswer = { type: "box", box: { top: 0.22, bottom: 0.33, left: 0.51, right: 0.63 }, confidence: 0.87 };
const noChoices = () => {
  throw new Error("the locator asks no choice questions");
};

locatorContract("Jev locator", () => createJevLocator(createFakeDecisionClient(noChoices)));

describe("createJevLocator", () => {
  it("asks where the target is and whether it is there, in one request about one image", async () => {
    const client = createFakeDecisionClient(noChoices);
    await createJevLocator(client).locate(await testImage(), "the person's face");
    expect(client.calls).toHaveLength(1);
    expect(Object.keys(client.assets[0]!)).toHaveLength(1);
    const questions = Object.values(client.calls[0]);
    expect(questions.map((q) => q.type).sort()).toEqual(["box", "noul"]);
    for (const q of questions) expect(q.instructions).toContain("the person's face");
  });

  it("points questions at the image by its name in the state, never by asset reference", async () => {
    const client = createFakeDecisionClient(noChoices);
    await createJevLocator(client).locate(await testImage(), "a face");
    const [ref] = Object.keys(client.assets[0]!);
    for (const q of Object.values(client.calls[0])) {
      expect(q.instructions).toContain("`image`");
      expect(q.instructions).not.toContain(ref);
    }
  });

  it("sends the image as a JPEG that fits Jev's limits", async () => {
    const client = createFakeDecisionClient(noChoices);
    await createJevLocator(client).locate(await testImage(3136, 2000), "a face");
    const [asset] = Object.values(client.assets[0]!);
    expect(asset.format).toBe("jpeg");
    const { width, height } = await sharp(Buffer.from(asset.data_base64, "base64")).metadata();
    expect({ width, height }).toEqual({ width: 1568, height: 1000 });
  });

  it("returns the box, its confidence, the presence probability, what the request cost and how long it took", async () => {
    const ticks = [1000, 1840];
    const locator = createJevLocator(createFakeDecisionClient(noChoices, { ...FAKE_SIGHT, box: FACE, noul: 0.97 }), { now: () => ticks.shift()! });
    const location = await locator.locate(await testImage(), "a face");
    expect(location).toEqual({ box: FACE.box, confidence: 0.87, presence: 0.97, model: "fake-1.0.0", inputTokens: 100, latencyMs: 840 });
  });

  it("says which answer came back as the wrong type", async () => {
    const client: DecisionClient = {
      async decide(_state, questions) {
        const answers = Object.fromEntries(Object.keys(questions).map((id) => [id, { type: "noul" as const, noul: 0.5 }]));
        return { model: "m", answers, usage: { input_tokens: 1, output_tokens: 1 }, latencyMs: 1 };
      },
    };
    await expect(createJevLocator(client).locate(await testImage(), "a cat")).rejects.toThrow("answered 'where' with a noul answer, expected box");
  });
});
