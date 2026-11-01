// Checks an answer against the question it was asked. Parsing only proves the response is well formed;
// a well-formed answer can still be for the wrong options, and callers read every option's probability.
import type { DecisionResult } from "./client.ts";
import type { ChoiceAnswer, ChoiceQuestion } from "./parse.ts";

/** The answer to `questionId`, with its choice and probabilities over exactly the question's options. */
export function answerFor(result: DecisionResult, questionId: string, question: ChoiceQuestion): ChoiceAnswer {
  const answer = result.answers[questionId];
  if (!answer) throw new Error(`No '${questionId}' answer in response: ${JSON.stringify(result.answers)}`);
  const options = Object.keys(question.criteria);
  if (!options.includes(answer.choice)) throw new Error(`Decision model chose "${answer.choice}" for '${questionId}', which is not one of its options`);
  assertOnePerOption(answer.probabilities, options, questionId);
  return answer;
}

/** A missing or extra option would skew any average or score built from the probabilities, silently. */
function assertOnePerOption(probabilities: Record<string, number>, options: string[], questionId: string): void {
  const missing = options.filter((o) => !(o in probabilities));
  const extra = Object.keys(probabilities).filter((o) => !options.includes(o));
  if (missing.length || extra.length) {
    throw new Error(
      `'${questionId}' probabilities must have one entry per option (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`,
    );
  }
}
