// Picking the best image of a set with Jev: all images go in one request, asked about once per rotation of their order,
// so every image is shown once in every position and position bias cancels out of the average. The images sit in the
// state once and questions point at them by path: an image referenced in instructions is sent again for every question.
import { answerFor } from "../jev/answers.ts";
import type { DecisionClient, DecisionResult } from "../jev/client.ts";
import type { ChoiceQuestion } from "../jev/parse.ts";
import { shortHash } from "../shared/hash.ts";
import { toAsset, WHAT_COUNTS } from "./jev-images.ts";
import type { PickJudge, PickVerdict } from "./pick-judge.ts";

/** Recorded as the judge of every Jev pick. */
export const JEV_PICKER = "jev";

const MIN_CANDIDATES = 2;

/**
 * Opaque names: the only ones the model sees, so they must not hint at a candidate's model or order. Each image has an
 * asset reference and a different key in the state. A reference anywhere in a string is replaced by the image, so a
 * path that contained it would send the image again with every question.
 */
const ref = (candidate: number) => `asset-${shortHash(`asset-${candidate}`).slice(0, 6)}`;
const key = (candidate: number) => `c${shortHash(`key-${candidate}`).slice(0, 6)}`;

/** Question ids reach the model too, so they name the rotation neutrally. */
const questionId = (rotation: number) => `order${rotation + 1}`;

const option = (position: number) => `image${position + 1}`;

const instructions = (keys: string[]) =>
  `${keys.length} images were generated for the creative brief in \`brief\`. ${keys.map((k, i) => `Image ${i + 1} is \`images.${k}\`.`).join(" ")} ` +
  `Which image best fulfils the brief? ${WHAT_COUNTS}`;

const criteria = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => [option(i), `Image ${i + 1} fulfils the brief best`]));

/** Changes whenever the picker's wording or options do. */
const PROMPT_VERSION = JSON.stringify({ instructions: instructions(["A", "B"]), criteria: criteria(2) });

/** In rotation `r`, Image `p + 1` is candidate `(r + p) mod n`. */
const candidateAt = (rotation: number, position: number, count: number) => (rotation + position) % count;

export function createJevPicker(client: DecisionClient): PickJudge {
  return {
    id: JEV_PICKER,
    version: PROMPT_VERSION,
    async pick({ brief, candidates }): Promise<PickVerdict> {
      const n = candidates.length;
      if (n < MIN_CANDIDATES) throw new Error(`A pick needs at least ${MIN_CANDIDATES} candidates, got ${n}`);
      const rotations = Array.from({ length: n }, (_, r) => r);
      const questions = Object.fromEntries(rotations.map((r) => [questionId(r), question(rotations.map((p) => key(candidateAt(r, p, n))))]));
      const assets = Object.fromEntries(candidates.map((image, c) => [ref(c), toAsset(image)]));
      // A string that is exactly a reference becomes the image; object keys stay text, so they name the paths.
      const result = await client.decide({ brief, images: Object.fromEntries(rotations.map((c) => [key(c), ref(c)])) }, questions, assets);
      return { ...tally(result, questions, n), model: result.model, inputTokens: result.usage.input_tokens, latencyMs: result.latencyMs };
    },
  };
}

const question = (keys: string[]): ChoiceQuestion => ({ type: "choice", instructions: instructions(keys), criteria: criteria(keys.length) });

/** Maps every rotation's answer back from positions to candidates, averages the probabilities and counts the votes. */
function tally(result: DecisionResult, questions: Record<string, ChoiceQuestion>, n: number): Pick<PickVerdict, "best" | "probabilities" | "agreement"> {
  const probabilities = new Array<number>(n).fill(0);
  const votes: number[] = [];
  for (let r = 0; r < n; r++) {
    const id = questionId(r);
    const answer = answerFor(result, id, questions[id]);
    for (let p = 0; p < n; p++) probabilities[candidateAt(r, p, n)] += answer.probabilities[option(p)] / n;
    votes.push(candidateAt(r, Object.keys(questions[id].criteria).indexOf(answer.choice), n));
  }
  const best = probabilities.indexOf(Math.max(...probabilities));
  return { best, probabilities, agreement: votes.filter((v) => v === best).length / n };
}
