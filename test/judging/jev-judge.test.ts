import { describe, expect, it } from "vitest";
import type { DecisionClient } from "../../src/jev/client.ts";
import type { ImageAsset, Question } from "../../src/jev/parse.ts";
import { createJevJudge, JEV_JUDGE } from "../../src/judging/jev-judge.ts";
import type { JudgedImage } from "../../src/judging/pair-judge.ts";
import { createFakeDecisionClient } from "../support/fake-decision-client.ts";

const image = (data: string): JudgedImage => ({ format: "png", data: Buffer.from(data) });
const judgeWithJev = (client: DecisionClient, judged: typeof pair) => createJevJudge(client).judge(judged);
const pair = { brief: "a red apple", routed: image("ROUTED"), default: image("DEFAULT") };

/** Which asset a question calls Image 1, read from its instructions the way the model would. */
const image1 = (q: Question, assets: Record<string, ImageAsset>) => {
  const ref = /Image 1 is (\S+)\./.exec(q.instructions)![1];
  return decoded(assets[ref]);
};

const decoded = (asset: ImageAsset) => Buffer.from(asset.data_base64, "base64").toString();

describe("createJevJudge", () => {
  it("identifies itself as the jev judge and versions its prompt", () => {
    const judge = createJevJudge(createFakeDecisionClient(() => ({ choice: "tie", confidence: 0.6 })));
    expect(judge.id).toBe(JEV_JUDGE);
    expect(judge.version).toMatch(/fulfils the brief/);
  });

  it("sends both images once and asks in both orders", async () => {
    const client = createFakeDecisionClient(() => ({ choice: "tie", confidence: 0.6 }));
    await judgeWithJev(client, pair);
    const [questions] = client.calls;
    const assets = client.assets[0]!;
    expect(Object.values(assets).map(decoded).sort()).toEqual(["DEFAULT", "ROUTED"]);
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
    expect(verdict).toMatchObject({ model: "fake-1.0.0", inputTokens: 100, latencyMs: 1 });
  });

  it("rejects an answer that doesn't cover every outcome instead of scoring it as a loss", async () => {
    const answer = { type: "choice" as const, choice: "second", confidence: 0.9, probabilities: { second: 0.9, tie: 0.1 } };
    const client: DecisionClient = {
      decide: async () => ({ model: "m", answers: { order1: answer, order2: answer }, usage: { input_tokens: 0, output_tokens: 0 }, latencyMs: 0 }),
    };
    await expect(judgeWithJev(client, pair)).rejects.toThrow(/missing: first; extra: none/);
  });

  it("rejects a response missing one of the two orders", async () => {
    const client: DecisionClient = { decide: async () => ({ model: "m", answers: {}, usage: { input_tokens: 0, output_tokens: 0 }, latencyMs: 0 }) };
    await expect(judgeWithJev(client, pair)).rejects.toThrow(/No 'order1' answer/);
  });

  it("calls a tie when a judge just prefers whichever image comes first", async () => {
    const client = createFakeDecisionClient(() => ({ choice: "first", confidence: 0.8 }));
    const verdict = await judgeWithJev(client, pair);
    expect(verdict.probabilities.routed).toBeCloseTo(verdict.probabilities.default);
    expect(verdict.winner).toBe("tie");
  });
});
