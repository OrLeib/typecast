// Wire types for the SystemOne (Jev) decision API, and a strict parser for its responses.
import { expectNumber, expectProbabilities, expectProbability, expectRecord, expectString, withSource } from "../shared/validate.ts";

export type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};

/** Where something is in an image. Takes no criteria, and needs an image in the request. */
export type BoxQuestion = { type: "box"; instructions: string };

/** A yes/no question, answered with the probability of yes. */
export type NoulQuestion = { type: "noul"; instructions: string };

export type Question = ChoiceQuestion | BoxQuestion | NoulQuestion;

/**
 * An image sent with a request, keyed in `assets` by a reference string. The reference is written into the state or a
 * question's instructions wherever the image belongs; the API swaps it for the image. PNG or JPEG, 280-1568px a side.
 */
export type ImageAsset = { type: "image"; format: "png" | "jpg" | "jpeg"; data_base64: string };

export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

/** Edges as fractions of the image's width (left, right) or height (top, bottom), from the top-left corner. */
export type Box = { top: number; bottom: number; left: number; right: number };

export type BoxAnswer = { type: "box"; box: Box; confidence: number };

export type NoulAnswer = { type: "noul"; noul: number };

export type Answer = ChoiceAnswer | BoxAnswer | NoulAnswer;

export type Usage = { input_tokens: number; output_tokens: number };

/** Response envelope, verified against jev-1.14.0 (choice on 2026-10-31, box and noul on 2026-11-01). */
export type DecisionResponse = {
  model: string;
  answers: Record<string, Answer>;
  usage: Usage;
};

/** Validates the raw response body and throws with the offending path on any mismatch. */
export function parseDecisionResponse(raw: unknown): DecisionResponse {
  return withSource("Jev response", () => {
    const body = expectRecord(raw, "response");
    const usage = expectRecord(body.usage, "usage");
    const answers = expectRecord(body.answers, "answers");
    return {
      model: expectString(body.model, "model"),
      usage: {
        input_tokens: expectNumber(usage.input_tokens, "usage.input_tokens"),
        output_tokens: expectNumber(usage.output_tokens, "usage.output_tokens"),
      },
      answers: Object.fromEntries(
        Object.entries(answers).map(([id, answer]) => [id, parseAnswer(answer, `answers.${id}`)]),
      ),
    };
  });
}

function parseAnswer(raw: unknown, path: string): Answer {
  const answer = expectRecord(raw, path);
  if (answer.type === "choice") return parseChoiceAnswer(answer, path);
  if (answer.type === "box") return { type: "box", box: parseBox(answer.box, `${path}.box`), confidence: expectProbability(answer.confidence, `${path}.confidence`) };
  if (answer.type === "noul") return { type: "noul", noul: expectProbability(answer.noul, `${path}.noul`) };
  throw new Error(`${path}.type must be "choice", "box" or "noul", got ${JSON.stringify(answer.type)}`);
}

/** Edges are fractions, so the same range check as a probability applies. */
function parseBox(raw: unknown, path: string): Box {
  const box = expectRecord(raw, path);
  const [top, bottom, left, right] = (["top", "bottom", "left", "right"] as const).map((edge) => expectProbability(box[edge], `${path}.${edge}`));
  if (left >= right) throw new Error(`${path}: left (${left}) must be less than right (${right})`);
  if (top >= bottom) throw new Error(`${path}: top (${top}) must be less than bottom (${bottom})`);
  return { top, bottom, left, right };
}

function parseChoiceAnswer(answer: Record<string, unknown>, path: string): ChoiceAnswer {
  const probabilities = expectProbabilities(answer.probabilities, `${path}.probabilities`);
  const choice = expectString(answer.choice, `${path}.choice`);
  if (!(choice in probabilities)) throw new Error(`${path}.choice "${choice}" is not in probabilities`);
  return { type: "choice", choice, confidence: expectProbability(answer.confidence, `${path}.confidence`), probabilities };
}
