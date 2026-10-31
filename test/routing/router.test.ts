import { describe, expect, it } from "vitest";
import type { DecisionClient } from "../../src/jev/client.ts";
import { createDecisionRouter } from "../../src/routing/router.ts";
import { DEFAULT_VARIANT, getVariant, VARIANTS, type Variant } from "../../src/routing/variants.ts";
import { createFakeDecisionClient } from "../support/fake-decision-client.ts";

const variant: Variant = { instructions: "Pick a category", roster: { stills: "Still images", motion: "Video" } };

describe("createDecisionRouter", () => {
  it("asks one choice question built from the variant and returns the answer with run details", async () => {
    const client = createFakeDecisionClient(() => ({ choice: "motion", confidence: 0.8 }));
    const route = await createDecisionRouter(client, variant).route("a looping clip");

    expect(client.calls).toEqual([{ model: { type: "choice", instructions: "Pick a category", criteria: variant.roster } }]);
    expect(route).toMatchObject({ choice: "motion", confidence: 0.8, model: "fake-1.0.0", inputTokens: 100, latencyMs: 1 });
  });

  it("rejects a choice outside the roster", async () => {
    const client = createFakeDecisionClient(() => ({ choice: "audio", confidence: 0.9 }));
    await expect(createDecisionRouter(client, variant).route("x")).rejects.toThrow(/"audio", which is not in the roster/);
  });

  it("rejects probabilities that don't cover the roster exactly", async () => {
    const answer = { type: "choice" as const, choice: "motion", confidence: 0.9, probabilities: { motion: 0.9, audio: 0.1 } };
    const client: DecisionClient = { decide: async () => ({ model: "m", answers: { model: answer }, usage: { input_tokens: 0, output_tokens: 0 }, latencyMs: 0 }) };
    await expect(createDecisionRouter(client, variant).route("x")).rejects.toThrow(/missing: stills; extra: audio/);
  });

  it("rejects a response without its answer", async () => {
    const client: DecisionClient = { decide: async () => ({ model: "m", answers: {}, usage: { input_tokens: 0, output_tokens: 0 }, latencyMs: 0 }) };
    await expect(createDecisionRouter(client, variant).route("x")).rejects.toThrow(/No 'model' answer/);
  });
});

describe("getVariant", () => {
  it("returns known variants and names the known ones on a typo", () => {
    expect(getVariant("baseline").instructions).toMatch(/\S/);
    expect(() => getVariant("baselin")).toThrow(/Unknown variant "baselin". Known: baseline/);
  });

  it("defaults to a registered variant", () => {
    expect(Object.keys(VARIANTS)).toContain(DEFAULT_VARIANT);
  });
});
