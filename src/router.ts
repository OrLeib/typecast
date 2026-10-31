import { decide, type ChoiceAnswer } from "./jev.ts";
import { VARIANTS, type Variant } from "./variants.ts";

export type Route = ChoiceAnswer & { model: string; inputTokens: number; latencyMs: number };

export async function route(brief: string, variant: Variant = VARIANTS.baseline): Promise<Route> {
  const res = await decide(brief, {
    model: { type: "choice", instructions: variant.instructions, criteria: variant.roster },
  });
  const answer = res.answers.model;
  if (!answer) throw new Error(`No 'model' answer in response: ${JSON.stringify(res.answers)}`);
  return { ...answer, model: res.model, inputTokens: res.usage.input_tokens, latencyMs: res.latencyMs };
}
