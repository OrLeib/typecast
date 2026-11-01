import { describe, expect, it } from "vitest";
import type { ChoiceQuestion, ImageAsset } from "../../src/jev/parse.ts";
import { judgeWithJev } from "../../src/judging/jev-judge.ts";
import { createFakeDecisionClient } from "../support/fake-decision-client.ts";

const image = (data: string): ImageAsset => ({ type: "image", format: "png", data_base64: data });
const pair = { brief: "a red apple", routed: image("ROUTED"), default: image("DEFAULT") };

/** Which asset a question calls Image 1, read from its instructions the way the model would. */
const image1 = (q: ChoiceQuestion, assets: Record<string, ImageAsset>) => {
  const ref = /Image 1 is (\S+)\./.exec(q.instructions)![1];
  return assets[ref].data_base64;
};

describe("judgeWithJev", () => {
  it("sends both images once and asks in both orders", async () => {
    const client = createFakeDecisionClient(() => ({ choice: "tie", confidence: 0.6 }));
    await judgeWithJev(client, pair);
    const [questions] = client.calls;
    const assets = client.assets[0]!;
    expect(Object.values(assets).map((a) => a.data_base64).sort()).toEqual(["DEFAULT", "ROUTED"]);
    expect(Object.values(questions).map((q) => image1(q, assets)).sort()).toEqual(["DEFAULT", "ROUTED"]);
  });

  it("never tells the model which image was routed", async () => {
    const client = createFakeDecisionClient(() => ({ choice: "tie", confidence: 0.6 }));
    await judgeWithJev(client, pair);
    const sent = JSON.stringify(client.calls[0]) + Object.keys(client.assets[0]!).join(" ");
    expect(sent).not.toMatch(/routed|default/i);
  });

  it("maps each order's answer back to routed or default and averages the two", async () => {
    let assets: Record<string, ImageAsset> = {};
    // A judge that always prefers the routed image, wherever it is shown.
    const client = createFakeDecisionClient((_state, q) => ({ choice: image1(q, assets) === "ROUTED" ? "first" : "second", confidence: 0.8 }));
    const decide = client.decide.bind(client);
    client.decide = (state, questions, sent) => ((assets = sent!), decide(state, questions, sent));

    const verdict = await judgeWithJev(client, pair);
    expect(verdict.winner).toBe("routed");
    expect(verdict.probabilities.routed).toBeCloseTo(0.8);
    expect(verdict.probabilities.default).toBeCloseTo(0.1);
    expect(verdict).toMatchObject({ model: "fake-1.0.0", inputTokens: 100 });
  });

  it("calls a tie when a judge just prefers whichever image comes first", async () => {
    const client = createFakeDecisionClient(() => ({ choice: "first", confidence: 0.8 }));
    const verdict = await judgeWithJev(client, pair);
    expect(verdict.probabilities.routed).toBeCloseTo(verdict.probabilities.default);
    expect(verdict.winner).toBe("tie");
  });
});
