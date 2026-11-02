import { describe, expect, it } from "vitest";
import type { DecisionClient } from "../../src/jev/client.ts";
import type { ImageAsset, Question } from "../../src/jev/parse.ts";
import { createJevPicker, JEV_PICKER } from "../../src/judging/jev-picker.ts";
import type { JudgedImage } from "../../src/judging/pair-judge.ts";
import { createFakeDecisionClient } from "../support/fake-decision-client.ts";
import { pickJudgeContract } from "./pick-judge.contract.ts";

const image = (data: string): JudgedImage => ({ format: "png", data: Buffer.from(data) });
const set = { brief: "a red apple", candidates: [image("A"), image("B"), image("C")] };
const decoded = (asset: ImageAsset) => Buffer.from(asset.data_base64, "base64").toString();

type Sent = { state: { brief: string; images: Record<string, string> }; assets: Record<string, ImageAsset> };

/** The images a question shows, in position order, resolved through the state's paths the way the model would. */
const shown = (q: Question, { state, assets }: Sent) =>
  [...q.instructions.matchAll(/Image \d+ is `images\.(\w+)`\./g)].map((m) => decoded(assets[state.images[m[1]]]));

/** Records every request's state and assets alongside the fake's calls. */
function recording(client: ReturnType<typeof createFakeDecisionClient>) {
  const sent: Sent[] = [];
  const decide = client.decide.bind(client);
  client.decide = (state, questions, assets) => (sent.push({ state: state as Sent["state"], assets: assets! }), decide(state, questions, assets));
  return { client, sent };
}

/** A fake Jev that sees the images: it answers with `pick(images shown, in order)`. */
function seeingClient(pick: (images: string[]) => { position: number; confidence: number }) {
  const { client, sent } = recording(createFakeDecisionClient((_state, q) => {
    const { position, confidence } = pick(shown(q, sent.at(-1)!));
    return { choice: Object.keys(q.criteria)[position], confidence };
  }));
  return client;
}

pickJudgeContract("createJevPicker", () => createJevPicker(createFakeDecisionClient(() => ({ choice: "image1", confidence: 0.6 }))));

describe("createJevPicker", () => {
  it("identifies itself as the jev picker", () => {
    expect(createJevPicker(createFakeDecisionClient(() => ({ choice: "image1", confidence: 1 }))).id).toBe(JEV_PICKER);
  });

  it("sends each image once and shows every image once in every position", async () => {
    const { client, sent } = recording(createFakeDecisionClient(() => ({ choice: "image1", confidence: 0.6 })));
    await createJevPicker(client).pick(set);
    expect(Object.values(sent[0].assets).map(decoded).sort()).toEqual(["A", "B", "C"]);
    const orders = Object.values(client.calls[0]).map((q) => shown(q, sent[0]));
    expect(orders).toHaveLength(3);
    for (let position = 0; position < 3; position++) expect(orders.map((o) => o[position]).sort()).toEqual(["A", "B", "C"]);
  });

  it("puts every image in the state once, and never names an asset reference where it would be sent again", async () => {
    const { client, sent } = recording(createFakeDecisionClient(() => ({ choice: "image1", confidence: 0.6 })));
    await createJevPicker(client).pick(set);
    const refs = Object.keys(sent[0].assets);
    expect(Object.values(sent[0].state.images).sort()).toEqual([...refs].sort());
    const elsewhere = JSON.stringify(client.calls[0]) + Object.keys(sent[0].state.images).join(" ") + sent[0].state.brief;
    for (const r of refs) expect(elsewhere).not.toContain(r);
  });

  it("maps every order's answer back to the candidate shown, wherever it was", async () => {
    const verdict = await createJevPicker(seeingClient((images) => ({ position: images.indexOf("C"), confidence: 0.8 }))).pick(set);
    expect(verdict.best).toBe(2);
    expect(verdict.probabilities[2]).toBeCloseTo(0.8);
    expect(verdict.probabilities[0]).toBeCloseTo(0.1);
    expect(verdict.agreement).toBe(1);
    expect(verdict).toMatchObject({ model: "fake-1.0.0", inputTokens: 100, latencyMs: 1 });
  });

  it("shows a judge that just prefers the first position as having no preference", async () => {
    const verdict = await createJevPicker(seeingClient(() => ({ position: 0, confidence: 0.9 }))).pick(set);
    for (const p of verdict.probabilities) expect(p).toBeCloseTo(1 / 3);
    expect(verdict.agreement).toBeCloseTo(1 / 3);
  });

  it("rejects a response missing one of the orders", async () => {
    const client: DecisionClient = { decide: async () => ({ model: "m", answers: {}, usage: { input_tokens: 0, output_tokens: 0 }, latencyMs: 0 }) };
    await expect(createJevPicker(client).pick(set)).rejects.toThrow(/No 'order1' answer/);
  });
});
