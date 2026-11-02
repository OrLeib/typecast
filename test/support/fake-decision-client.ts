import type { DecisionClient, DecisionResult } from "../../src/jev/client.ts";
import type { Answer, BoxAnswer, ChoiceQuestion, ImageAsset, Question } from "../../src/jev/parse.ts";

type Pick = { choice: string; confidence: number };

/** What the fake says to box and noul questions unless told otherwise: the image's centre quarter, seen clearly. */
export const FAKE_SIGHT = {
  box: { type: "box", box: { top: 0.25, bottom: 0.75, left: 0.25, right: 0.75 }, confidence: 0.9 } as BoxAnswer,
  noul: 0.9,
};

/**
 * In-memory DecisionClient: answers every choice question with `pick`, spreading leftover probability over the other
 * options, and every box or noul question with `sight`.
 */
export function createFakeDecisionClient(
  pick: (state: string | object, question: ChoiceQuestion) => Pick,
  sight: { box: BoxAnswer; noul: number } = FAKE_SIGHT,
): DecisionClient & { calls: Record<string, Question>[]; assets: (Record<string, ImageAsset> | undefined)[] } {
  const calls: Record<string, Question>[] = [];
  const assets: (Record<string, ImageAsset> | undefined)[] = [];
  const answer = (state: string | object, q: Question): Answer => {
    if (q.type === "box") return sight.box;
    if (q.type === "noul") return { type: "noul", noul: sight.noul };
    const { choice, confidence } = pick(state, q);
    const others = Object.keys(q.criteria).filter((o) => o !== choice);
    const probabilities = Object.fromEntries([[choice, confidence], ...others.map((o) => [o, (1 - confidence) / others.length])]);
    return { type: "choice", choice, confidence, probabilities };
  };
  return {
    calls,
    assets,
    async decide(state, questions, sentAssets): Promise<DecisionResult> {
      calls.push(questions);
      assets.push(sentAssets);
      const answers = Object.fromEntries(Object.entries(questions).map(([id, q]) => [id, answer(state, q)]));
      return { model: "fake-1.0.0", answers, usage: { input_tokens: 100, output_tokens: 10 }, latencyMs: 1 };
    },
  };
}
