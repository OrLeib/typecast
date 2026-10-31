// Behaviour every DecisionClient must have, so any implementation can stand in for another (LSP).
import { describe, expect, it } from "vitest";
import type { DecisionClient } from "../../src/jev/client.ts";
import type { ChoiceQuestion } from "../../src/jev/parse.ts";
import { ROSTER } from "../../src/routing/roster.ts";

export const CONTRACT_QUESTIONS: Record<string, ChoiceQuestion> = {
  model: { type: "choice", instructions: "Which category fits?", criteria: ROSTER },
};

export function decisionClientContract(name: string, makeClient: () => DecisionClient) {
  describe(`${name} honours the DecisionClient contract`, () => {
    it("answers every question with a choice from its criteria", async () => {
      const result = await makeClient().decide("a brief", CONTRACT_QUESTIONS);
      for (const [id, question] of Object.entries(CONTRACT_QUESTIONS)) {
        const answer = result.answers[id];
        expect(answer.type).toBe("choice");
        expect(Object.keys(question.criteria)).toContain(answer.choice);
        expect(Object.keys(answer.probabilities).sort()).toEqual(Object.keys(question.criteria).sort());
        expect(answer.confidence).toBeGreaterThanOrEqual(0);
        expect(answer.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("reports the resolved model, token usage and a non-negative latency", async () => {
      const result = await makeClient().decide("a brief", CONTRACT_QUESTIONS);
      expect(result.model).toMatch(/\S/);
      expect(result.usage.input_tokens).toBeGreaterThanOrEqual(0);
      expect(result.usage.output_tokens).toBeGreaterThanOrEqual(0);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
}
