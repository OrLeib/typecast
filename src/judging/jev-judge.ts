// Auto-judging a pair with Jev: both images go in one request, asked about in both orders to cancel position bias.
import { answerFor } from "../jev/answers.ts";
import type { DecisionClient } from "../jev/client.ts";
import type { ChoiceQuestion } from "../jev/parse.ts";
import { toAsset, WHAT_COUNTS } from "./jev-images.ts";
import type { Winner } from "./judgments.ts";
import type { PairJudge, PairVerdict } from "./pair-judge.ts";

/** Recorded as the judge of every Jev judgment; `npm run judge-report -- <dir> --judge jev` reads them back. */
export const JEV_JUDGE = "jev";

/**
 * Opaque asset references. They are the only names the model sees for the images, so they must not hint at which is
 * routed. The routed image is always the first reference, which is safe because every pair is asked in both orders.
 */
const REF = { routed: "asset-7f3a", default: "asset-c41e" } as const;

/** Question ids reach the model too, so they name the order neutrally: the routed image is Image 1 in ORDER_A. */
const ORDER_A = "order1";
const ORDER_B = "order2";

const CRITERIA = {
  first: "Image 1 fulfils the brief better",
  second: "Image 2 fulfils the brief better",
  tie: "Both fulfil the brief about equally well",
};

const instructions = (image1: string, image2: string) =>
  `Two images were generated for the creative brief in \`brief\`. Image 1 is ${image1}. Image 2 is ${image2}. ` +
  `Which image better fulfils the brief? ${WHAT_COUNTS}`;

/** Changes whenever the judge's wording or options do. */
const PROMPT_VERSION = JSON.stringify({ instructions: instructions("1", "2"), criteria: CRITERIA });

const question = (image1: string, image2: string): ChoiceQuestion => ({ type: "choice", instructions: instructions(image1, image2), criteria: CRITERIA });

/** Probabilities are averaged over both orders. */
export function createJevJudge(client: DecisionClient): PairJudge {
  return {
    id: JEV_JUDGE,
    version: PROMPT_VERSION,
    async judge(pair): Promise<PairVerdict> {
      const questions = { [ORDER_A]: question(REF.routed, REF.default), [ORDER_B]: question(REF.default, REF.routed) };
      const result = await client.decide({ brief: pair.brief }, questions, { [REF.routed]: toAsset(pair.routed), [REF.default]: toAsset(pair.default) });
      // An unchecked missing option would average to NaN and argmax would call it a loss for routing.
      const a = answerFor(result, ORDER_A, questions[ORDER_A]).probabilities;
      const b = answerFor(result, ORDER_B, questions[ORDER_B]).probabilities;
      const probabilities: Record<Winner, number> = {
        routed: (a.first + b.second) / 2,
        default: (a.second + b.first) / 2,
        tie: (a.tie + b.tie) / 2,
      };
      return { winner: argmax(probabilities), probabilities, model: result.model, inputTokens: result.usage.input_tokens, latencyMs: result.latencyMs };
    },
  };
}

/** On an exact draw between a side and a tie, the tie wins: no clear preference is the honest call. */
function argmax(p: Record<Winner, number>): Winner {
  if (p.tie >= p.routed && p.tie >= p.default) return "tie";
  if (p.routed === p.default) return "tie";
  return p.routed > p.default ? "routed" : "default";
}
