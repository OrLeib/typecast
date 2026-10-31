import { decide, type ChoiceAnswer } from "./jev.ts";
import { ROSTER } from "./roster.ts";

export type Route = ChoiceAnswer & { model: string; inputTokens: number; latencyMs: number };

export async function route(brief: string, roster: Record<string, string> = ROSTER): Promise<Route> {
  const res = await decide(brief, {
    model: {
      type: "choice",
      instructions: "Which image or video model category best fits this creative brief?",
      criteria: roster,
    },
  });
  const answer = res.answers.model;
  if (!answer) throw new Error(`No 'model' answer in response: ${JSON.stringify(res.answers)}`);
  return { ...answer, model: res.model, inputTokens: res.usage.input_tokens, latencyMs: res.latencyMs };
}
