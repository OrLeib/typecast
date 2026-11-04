import { describe, expect, it } from "vitest";
import type { DecisionClient } from "../../src/jev/client.ts";
import type { JudgedImage } from "../../src/judging/pair-judge.ts";
import { createJevRater, JEV_RATER } from "../../src/judging/jev-rater.ts";
import { createFakeDecisionClient, FAKE_SIGHT } from "../support/fake-decision-client.ts";
import { imageRaterContract } from "./image-rater.contract.ts";

const noChoices = () => { throw new Error("the rater asks no choice questions"); };
const image: JudgedImage = { format: "png", data: Buffer.from("IMAGE") };

imageRaterContract("Jev rater", () => createJevRater(createFakeDecisionClient(noChoices)));

describe("createJevRater", () => {
  it("sends one image in the state, and asks every question in one request", async () => {
    const client = createFakeDecisionClient(noChoices);
    const seen: (string | object)[] = [];
    const spying: DecisionClient = { decide: (state, questions, assets) => { seen.push(state); return client.decide(state, questions, assets); } };
    await createJevRater(spying).rate("a red apple", image);

    expect(client.calls).toHaveLength(1);
    const [assets] = client.assets;
    const [ref] = Object.keys(assets!);
    expect(seen).toEqual([{ brief: "a red apple", image: ref }]);
    expect(Buffer.from(assets![ref].data_base64, "base64").toString()).toBe("IMAGE");
    for (const question of Object.values(client.calls[0])) expect(question.instructions).not.toContain(ref);
  });

  it("marks text only when the brief asks for words, averaging the criteria it marked", async () => {
    const rated = (noul: number) => createJevRater(createFakeDecisionClient(noChoices, { ...FAKE_SIGHT, noul, scoreShare: 0.5 })).rate("x", image);
    expect(Object.keys((await rated(0.9)).scores)).toEqual(["Brief", "Style", "Craft", "Text"]);
    const without = await rated(0.1);
    expect(Object.keys(without.scores)).toEqual(["Brief", "Style", "Craft"]);
    expect(without.total).toBeCloseTo(0.5);
  });

  it("records itself as the judge", () => {
    expect(createJevRater(createFakeDecisionClient(noChoices)).id).toBe(JEV_RATER);
  });

  it("refuses a score off its scale", async () => {
    const client = createFakeDecisionClient(noChoices);
    const offScale: DecisionClient = {
      decide: async (state, questions, assets) => {
        const result = await client.decide(state, questions, assets);
        return { ...result, answers: { ...result.answers, Craft: { type: "score", score: 9, confidence: 0.5, probabilities: { 0: 0, 1: 0, 2: 0, 3: 1 } } } };
      },
    };
    await expect(createJevRater(offScale).rate("x", image)).rejects.toThrow(/'Craft' score 9 is outside its 0-3 scale/);
  });
});
