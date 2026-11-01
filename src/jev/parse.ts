// Wire types for the SystemOne (Jev) decision API, and a strict parser for its responses.
import { expectNumber, expectProbabilities, expectProbability, expectRecord, expectString, withSource } from "../shared/validate.ts";

export type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};

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

export type Usage = { input_tokens: number; output_tokens: number };

/** Response envelope, verified against jev-1.14.0. */
export type DecisionResponse = {
  model: string;
  answers: Record<string, ChoiceAnswer>;
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
        Object.entries(answers).map(([id, answer]) => [id, parseChoiceAnswer(answer, `answers.${id}`)]),
      ),
    };
  });
}

function parseChoiceAnswer(raw: unknown, path: string): ChoiceAnswer {
  const answer = expectRecord(raw, path);
  if (answer.type !== "choice") throw new Error(`${path}.type must be "choice", got ${JSON.stringify(answer.type)}`);
  const probabilities = expectProbabilities(answer.probabilities, `${path}.probabilities`);
  const choice = expectString(answer.choice, `${path}.choice`);
  if (!(choice in probabilities)) throw new Error(`${path}.choice "${choice}" is not in probabilities`);
  return { type: "choice", choice, confidence: expectProbability(answer.confidence, `${path}.confidence`), probabilities };
}
