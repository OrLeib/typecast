// Scoring an image with Jev: one request per image, so no image is seen beside another and order can't sway its scores,
// with one score question per criterion. The combining happens here in code, where the weights can be read.
import { answerOfType, scoreShareFor } from "../jev/answers.ts";
import type { DecisionClient, DecisionResult } from "../jev/client.ts";
import type { Question, ScoreQuestion } from "../jev/parse.ts";
import type { ImageRater } from "./image-rater.ts";
import { toAsset } from "./jev-images.ts";

/** Recorded as the judge of every Jev rating. */
export const JEV_RATER = "jev";

const score = (instructions: string, criteria: string[]): ScoreQuestion => ({ type: "score", instructions, criteria });

/** Criterion -> question. Ids are what the page shows. Levels describe situations, since Jev judges each one on its own. */
const RUBRIC: Record<string, ScoreQuestion> = {
  Brief: score("How fully does the image in `image` deliver what the creative brief in `brief` asks for?", [
    "The main subject or request is missing or wrong",
    "The main subject is there, but important requested details are missing or wrong",
    "The subject and most requested details are there, with small misses",
    "Everything the brief asks for is there",
  ]),
  Style: score("How well does the look of the image in `image` match the style and mood the brief in `brief` asks for?", [
    "A clearly different style or mood from the one asked for",
    "Partly the style asked for, with parts that clash",
    "Mostly the style and mood asked for",
    "Exactly the style and mood asked for",
  ]),
  Craft: score("How well made does the image in `image` look, leaving aside any text in it and anything strange the brief in `brief` asks for?", [
    "Serious unintended distortions stand out: broken anatomy or garbled objects",
    "Noticeable unintended flaws in the main subject",
    "Small flaws, visible only on a close look",
    "No visible flaws",
  ]),
};

/** Only scored when the brief asks for words: an image with no text to get wrong shouldn't gain or lose by it. */
const TEXT = "Text";
const TEXT_QUESTION = score("How well does the image in `image` render the words the brief in `brief` asks for?", [
  "The words are missing or unreadable gibberish",
  "Some letters are wrong or garbled",
  "The right words, but hard to read",
  "Every word is spelled right and easy to read",
]);

const WANTS_TEXT = "wantsText";
const YES = 0.5;

const QUESTIONS: Record<string, Question> = {
  ...RUBRIC,
  [TEXT]: TEXT_QUESTION,
  [WANTS_TEXT]: { type: "noul", instructions: "Does the brief in `brief` ask for specific words to appear in the image?" },
};

/** A string that is exactly a reference becomes the image; questions reach it by its path in the state. */
const IMAGE_REF = "asset-image";

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

export function createJevRater(client: DecisionClient): ImageRater {
  return {
    id: JEV_RATER,
    version: JSON.stringify(QUESTIONS),
    async rate(brief, image) {
      const result = await client.decide({ brief, image: IMAGE_REF }, QUESTIONS, { [IMAGE_REF]: toAsset(image) });
      const scores = scoresFrom(result);
      return { scores, total: mean(Object.values(scores)), model: result.model, inputTokens: result.usage.input_tokens, latencyMs: result.latencyMs };
    },
  };
}

function scoresFrom(result: DecisionResult): Record<string, number> {
  const rubric = { ...RUBRIC, ...(answerOfType(result, WANTS_TEXT, "noul").noul >= YES ? { [TEXT]: TEXT_QUESTION } : {}) };
  return Object.fromEntries(Object.entries(rubric).map(([criterion, question]) => [criterion, scoreShareFor(result, criterion, question)]));
}
