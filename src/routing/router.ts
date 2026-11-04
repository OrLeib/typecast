import { answerFor, answerOfType } from "../jev/answers.ts";
import type { DecisionClient } from "../jev/client.ts";
import type { ChoiceQuestion, NoulQuestion } from "../jev/parse.ts";
import type { Reason, ReasonCheck } from "./reasons.ts";
import type { Variant } from "./variants.ts";

/** A routing decision: the chosen roster category, how sure the router is, and what the decision cost. */
export type Route = {
  choice: string;
  confidence: number;
  /** One entry per roster category. */
  probabilities: Record<string, number>;
  /** What the brief says on each roster category's deciding requirement. Empty for a router or variant that doesn't check. */
  reasons: Reason[];
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

const reasonId = (category: string) => `reason-${category}`;

const reasonQuestions = (checks: [string, ReasonCheck][]) =>
  Object.fromEntries(checks.map(([category, { question }]): [string, NoulQuestion] => [reasonId(category), { type: "noul", instructions: question }]));

/**
 * Routes by asking a decision model one choice question built from the variant, and in the same request one yes/no
 * question per category it has a reason check for. Questions are answered in isolation, so the checks can't sway the choice.
 */
export function createDecisionRouter(client: DecisionClient, variant: Variant): Router {
  const question: ChoiceQuestion = { type: "choice", instructions: variant.instructions, criteria: variant.roster };
  const checks = Object.entries(variant.reasons ?? {});
  const questions = { [QUESTION_ID]: question, ...reasonQuestions(checks) };
  return {
    async route(brief) {
      const res = await client.decide(brief, questions);
      const { choice, confidence, probabilities } = answerFor(res, QUESTION_ID, question);
      const reasons = checks.map(([category, { label }]) => ({ category, label, probability: answerOfType(res, reasonId(category), "noul").noul }));
      return { choice, confidence, probabilities, reasons, model: res.model, inputTokens: res.usage.input_tokens, latencyMs: res.latencyMs };
    },
  };
}
