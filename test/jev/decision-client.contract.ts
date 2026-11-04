// Behaviour every DecisionClient must have, so any implementation can stand in for another (LSP).
import { describe, expect, it } from "vitest";
import type { DecisionClient } from "../../src/jev/client.ts";
import type { ChoiceQuestion, ImageAsset, Question } from "../../src/jev/parse.ts";
import { ROSTER } from "../../src/routing/roster.ts";

const CHOICE: ChoiceQuestion = { type: "choice", instructions: "Which category fits?", criteria: ROSTER };

const CONTRACT_QUESTIONS: Record<string, Question> = {
  model: CHOICE,
  face: { type: "box", instructions: "the person's face in `photo`" },
  present: { type: "noul", instructions: "Is a human face visible in `photo`?" },
  craft: { type: "score", instructions: "How clean does `photo` look?", criteria: ["Broken", "Flawed", "Clean"] },
};

const PHOTO: Record<string, ImageAsset> = { "asset-photo": { type: "image", format: "png", data_base64: "iVBORw0KGgo=" } };

const inRange = (n: number) => {
  expect(n).toBeGreaterThanOrEqual(0);
  expect(n).toBeLessThanOrEqual(1);
};

export function decisionClientContract(name: string, makeClient: () => DecisionClient) {
  describe(`${name} honours the DecisionClient contract`, () => {
    const ask = () => makeClient().decide({ brief: "a brief", photo: "asset-photo" }, CONTRACT_QUESTIONS, PHOTO);

    it("answers a choice question with one of its criteria and a probability for each", async () => {
      const answer = (await ask()).answers.model;
      if (answer.type !== "choice") throw new Error(`expected a choice answer, got ${answer.type}`);
      expect(Object.keys(CHOICE.criteria)).toContain(answer.choice);
      expect(Object.keys(answer.probabilities).sort()).toEqual(Object.keys(CHOICE.criteria).sort());
      inRange(answer.confidence);
    });

    it("answers a box question with ordered edges inside the image", async () => {
      const answer = (await ask()).answers.face;
      if (answer.type !== "box") throw new Error(`expected a box answer, got ${answer.type}`);
      const { top, bottom, left, right } = answer.box;
      for (const edge of [top, bottom, left, right, answer.confidence]) inRange(edge);
      expect(left).toBeLessThan(right);
      expect(top).toBeLessThan(bottom);
    });

    it("answers a noul question with the probability of yes", async () => {
      const answer = (await ask()).answers.present;
      if (answer.type !== "noul") throw new Error(`expected a noul answer, got ${answer.type}`);
      inRange(answer.noul);
    });

    it("answers a score question on its scale, with a probability per level", async () => {
      const answer = (await ask()).answers.craft;
      if (answer.type !== "score") throw new Error(`expected a score answer, got ${answer.type}`);
      expect(Object.keys(answer.probabilities).sort()).toEqual(["0", "1", "2"]);
      expect(answer.score).toBeGreaterThanOrEqual(0);
      expect(answer.score).toBeLessThanOrEqual(2);
      inRange(answer.confidence);
    });

    it("reports the resolved model, token usage and a non-negative latency", async () => {
      const result = await ask();
      expect(result.model).toMatch(/\S/);
      expect(result.usage.input_tokens).toBeGreaterThanOrEqual(0);
      expect(result.usage.output_tokens).toBeGreaterThanOrEqual(0);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
}
