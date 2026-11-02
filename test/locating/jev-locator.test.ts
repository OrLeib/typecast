import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { DecisionClient } from "../../src/jev/client.ts";
import type { BoxAnswer } from "../../src/jev/parse.ts";
import { createJevLocator, MAX_IMAGES } from "../../src/locating/locator.ts";
import { createFakeDecisionClient } from "../support/fake-decision-client.ts";
import { locatorContract, testImage } from "./locator.contract.ts";

const FACE: BoxAnswer = { type: "box", box: { top: 0.22, bottom: 0.33, left: 0.51, right: 0.63 }, confidence: 0.87 };
const noChoices = () => {
  throw new Error("the locator asks no choice questions");
};

locatorContract("Jev locator", () => createJevLocator(createFakeDecisionClient(noChoices)));

describe("createJevLocator", () => {
  it("asks about each image in its own request, a box and a presence question each, all before any answer", async () => {
    const client = createFakeDecisionClient(noChoices);
    let pending = 0, mostPending = 0;
    const decide = client.decide.bind(client);
    client.decide = async (...args) => {
      mostPending = Math.max(mostPending, ++pending);
      await new Promise((resolve) => setTimeout(resolve, 5));
      pending--;
      return decide(...args);
    };
    await createJevLocator(client).locate([await testImage(), await testImage(), await testImage()], "the person's face");
    expect(client.calls).toHaveLength(3);
    expect(mostPending).toBe(3);
    for (const [i, questions] of client.calls.entries()) {
      expect(Object.keys(client.assets[i]!)).toHaveLength(1);
      expect(Object.values(questions).map((q) => q.type).sort()).toEqual(["box", "noul"]);
      for (const q of Object.values(questions)) expect(q.instructions).toContain("the person's face");
    }
  });

  it("points questions at the image by its name in the state, never by asset reference", async () => {
    const client = createFakeDecisionClient(noChoices);
    await createJevLocator(client).locate([await testImage()], "a face");
    const [ref] = Object.keys(client.assets[0]!);
    for (const q of Object.values(client.calls[0])) {
      expect(q.instructions).toContain("`image`");
      expect(q.instructions).not.toContain(ref);
    }
  });

  it("sends each image as a JPEG that fits Jev's limits", async () => {
    const client = createFakeDecisionClient(noChoices);
    await createJevLocator(client).locate([await testImage(3136, 2000)], "a face");
    const [asset] = Object.values(client.assets[0]!);
    expect(asset.format).toBe("jpeg");
    const { width, height } = await sharp(Buffer.from(asset.data_base64, "base64")).metadata();
    expect({ width, height }).toEqual({ width: 1568, height: 1000 });
  });

  it("returns each image's box, confidence and presence in order, the tokens of every request summed, and the wall time", async () => {
    const ticks = [1000, 1840];
    const locator = createJevLocator(createFakeDecisionClient(noChoices, { box: FACE, noul: 0.97 }), { now: () => ticks.shift()! });
    const located = await locator.locate([await testImage(), await testImage()], "a face");
    expect(located).toEqual({
      found: [
        { box: FACE.box, confidence: 0.87, presence: 0.97 },
        { box: FACE.box, confidence: 0.87, presence: 0.97 },
      ],
      model: "fake-1.0.0",
      inputTokens: 200,
      latencyMs: 840,
    });
  });

  it.each([0, MAX_IMAGES + 1])("refuses %i images before asking", async (count) => {
    const client = createFakeDecisionClient(noChoices);
    const images = await Promise.all(Array.from({ length: count }, () => testImage(300, 300)));
    await expect(createJevLocator(client).locate(images, "a face")).rejects.toThrow(`locate takes 1 to ${MAX_IMAGES} images, got ${count}`);
    expect(client.calls).toHaveLength(0);
  });

  it("says which answer came back as the wrong type", async () => {
    const client: DecisionClient = {
      async decide(_state, questions) {
        const answers = Object.fromEntries(Object.keys(questions).map((id) => [id, { type: "noul" as const, noul: 0.5 }]));
        return { model: "m", answers, usage: { input_tokens: 1, output_tokens: 1 }, latencyMs: 1 };
      },
    };
    await expect(createJevLocator(client).locate([await testImage()], "a cat")).rejects.toThrow("answered 'where' with a noul answer, expected box");
  });
});
