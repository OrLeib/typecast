import type { DecisionClient } from "../jev/client.ts";
import type { ChoiceAnswer } from "../jev/parse.ts";
import type { Variant } from "./variants.ts";

export type Route = ChoiceAnswer & { model: string; inputTokens: number; latencyMs: number };

/** Picks a roster category for a brief. The only thing evaluation needs from routing. */
export interface Router {
  route(brief: string): Promise<Route>;
}

const QUESTION_ID = "model";

/** Routes by asking a decision model one choice question built from the variant. */
export function createDecisionRouter(client: DecisionClient, variant: Variant): Router {
  return {
    async route(brief) {
      const res = await client.decide(brief, {
        [QUESTION_ID]: { type: "choice", instructions: variant.instructions, criteria: variant.roster },
      });
      const answer = res.answers[QUESTION_ID];
      if (!answer) throw new Error(`No '${QUESTION_ID}' answer in response: ${JSON.stringify(res.answers)}`);
      if (!(answer.choice in variant.roster)) throw new Error(`Decision model chose "${answer.choice}", which is not in the roster`);
      return { ...answer, model: res.model, inputTokens: res.usage.input_tokens, latencyMs: res.latencyMs };
    },
  };
}
