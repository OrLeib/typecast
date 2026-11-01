import { answerFor } from "../jev/answers.ts";
import type { DecisionClient } from "../jev/client.ts";
import type { ChoiceQuestion } from "../jev/parse.ts";
import type { Variant } from "./variants.ts";

/** A routing decision: the chosen roster category, how sure the router is, and what the decision cost. */
export type Route = {
  choice: string;
  confidence: number;
  /** One entry per roster category. */
  probabilities: Record<string, number>;
  model: string;
  inputTokens: number;
  latencyMs: number;
};

/** Picks a roster category for a brief. The only thing evaluation needs from routing. */
export interface Router {
  route(brief: string): Promise<Route>;
}

/** Options from most to least likely. */
export const rankOptions = (probabilities: Record<string, number>): [string, number][] =>
  Object.entries(probabilities).sort(([, a], [, b]) => b - a);

const QUESTION_ID = "model";

/** Routes by asking a decision model one choice question built from the variant. */
export function createDecisionRouter(client: DecisionClient, variant: Variant): Router {
  const question: ChoiceQuestion = { type: "choice", instructions: variant.instructions, criteria: variant.roster };
  return {
    async route(brief) {
      const res = await client.decide(brief, { [QUESTION_ID]: question });
      const { choice, confidence, probabilities } = answerFor(res, QUESTION_ID, question);
      return { choice, confidence, probabilities, model: res.model, inputTokens: res.usage.input_tokens, latencyMs: res.latencyMs };
    },
  };
}
