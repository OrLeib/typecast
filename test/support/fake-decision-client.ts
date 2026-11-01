import type { DecisionClient, DecisionResult } from "../../src/jev/client.ts";
import type { ChoiceQuestion, ImageAsset } from "../../src/jev/parse.ts";

type Pick = { choice: string; confidence: number };

/** In-memory DecisionClient: answers every question with `pick`, spreading leftover probability over the other options. */
export function createFakeDecisionClient(
  pick: (state: string | object, question: ChoiceQuestion) => Pick,
): DecisionClient & { calls: Record<string, ChoiceQuestion>[]; assets: (Record<string, ImageAsset> | undefined)[] } {
  const calls: Record<string, ChoiceQuestion>[] = [];
  const assets: (Record<string, ImageAsset> | undefined)[] = [];
  return {
    calls,
    assets,
    async decide(state, questions, sentAssets): Promise<DecisionResult> {
      calls.push(questions);
      assets.push(sentAssets);
      const answers = Object.fromEntries(Object.entries(questions).map(([id, q]) => {
        const { choice, confidence } = pick(state, q);
        const others = Object.keys(q.criteria).filter((o) => o !== choice);
        const probabilities = Object.fromEntries([[choice, confidence], ...others.map((o) => [o, (1 - confidence) / others.length])]);
        return [id, { type: "choice" as const, choice, confidence, probabilities }];
      }));
      return { model: "fake-1.0.0", answers, usage: { input_tokens: 100, output_tokens: 10 }, latencyMs: 1 };
    },
  };
}
