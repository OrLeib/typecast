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
      assertOnePerOption(answer.probabilities, Object.keys(variant.roster));
      return { ...answer, model: res.model, inputTokens: res.usage.input_tokens, latencyMs: res.latencyMs };
    },
  };
}

/** Log-loss and Brier read every option's probability, so a missing or extra one would skew them silently. */
function assertOnePerOption(probabilities: Record<string, number>, options: string[]): void {
  const missing = options.filter((o) => !(o in probabilities));
  const extra = Object.keys(probabilities).filter((o) => !options.includes(o));
  if (missing.length || extra.length) {
    throw new Error(`probabilities must have one entry per roster option (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`);
  }
}
