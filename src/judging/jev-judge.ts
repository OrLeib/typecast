// Auto-judging a pair with Jev: both images go in one request, asked about in both orders to cancel position bias.
import type { DecisionClient } from "../jev/client.ts";
import type { ChoiceQuestion, ImageAsset } from "../jev/parse.ts";
import type { Winner } from "./judgments.ts";

export type JudgedPair = { brief: string; routed: ImageAsset; default: ImageAsset };

export type JevVerdict = {
  winner: Winner;
  /** Each outcome's probability, averaged over both orders. */
  probabilities: Record<Winner, number>;
  /** The resolved model that judged, e.g. "jev-1.14.0"; recorded as the judge. */
  model: string;
  inputTokens: number;
};

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
  "Which image better fulfils the brief? Weigh how faithfully it follows the brief (subject, style, mood, " +
  "composition, and any text that must be legible) and its visual quality (no artifacts, distortions or garbled details).";

const question = (image1: string, image2: string): ChoiceQuestion => ({ type: "choice", instructions: instructions(image1, image2), criteria: CRITERIA });

export async function judgeWithJev(client: DecisionClient, pair: JudgedPair): Promise<JevVerdict> {
  const result = await client.decide(
    { brief: pair.brief },
    { [ORDER_A]: question(REF.routed, REF.default), [ORDER_B]: question(REF.default, REF.routed) },
    { [REF.routed]: pair.routed, [REF.default]: pair.default },
  );
  const a = result.answers[ORDER_A].probabilities;
  const b = result.answers[ORDER_B].probabilities;
  const probabilities: Record<Winner, number> = {
    routed: (a.first + b.second) / 2,
    default: (a.second + b.first) / 2,
    tie: (a.tie + b.tie) / 2,
  };
  return { winner: argmax(probabilities), probabilities, model: result.model, inputTokens: result.usage.input_tokens };
}

/** On an exact draw between a side and a tie, the tie wins: no clear preference is the honest call. */
function argmax(p: Record<Winner, number>): Winner {
  if (p.tie >= p.routed && p.tie >= p.default) return "tie";
  if (p.routed === p.default) return "tie";
  return p.routed > p.default ? "routed" : "default";
}
