// Finding a described target in images. The Jev locator asks about each image in its own request, all at once, with two
// questions: a box for where the target is, and a noul for whether it is there at all, because a box answer always comes
// back even when the target is missing.
import { answerOfType } from "../jev/answers.ts";
import type { DecisionClient } from "../jev/client.ts";
import type { Box } from "../jev/parse.ts";
import { prepareForJev } from "./images.ts";

/** Where the target is in one image. */
export type Found = {
  box: Box;
  /** How sure the locator is of the box's edges, 0 to 1. */
  confidence: number;
  /** Probability that the target is in the image at all, 0 to 1. */
  presence: number;
};

/** One answer per image, in the order the images were given, and what finding them cost. */
export type Located = {
  found: Found[];
  model: string;
  inputTokens: number;
  /** From the first request to the last answer, retries included. */
  latencyMs: number;
};

/** Anything that finds a target in PNG or JPEG images: Jev today, a dedicated detector later. */
export interface Locator {
  locate(images: Buffer[], target: string): Promise<Located>;
}

/**
 * About one in nine image requests fired together got a 503 ("Image processing is unavailable") while the rest answered
 * in under a second (2026-11-01), so a locator's client should retry at once rather than back off for seconds.
 */
export const JEV_LOCATE_RETRIES = { attempts: 4, delayMs: 250 };

/** Enough for a contact sheet; the requests run in parallel, so more only adds load. */
export const MAX_IMAGES = 12;

/** The image's only name in a request, so the target's description is the only hint at what to find. */
const IMAGE_REF = "asset-image";
const WHERE = "where";
const PRESENT = "present";

/**
 * One request per image. Asking about eight images in one request cost the same tokens but loosened the boxes: a cyclist's
 * face came back as a body-height strip at 0.23 confidence, against a tight box at 0.82 alone (jev-1.14.0, 2026-11-01).
 */
export function createJevLocator(client: DecisionClient, { now = () => performance.now() }: { now?: () => number } = {}): Locator {
  async function locateOne(image: Buffer, target: string) {
    const { asset } = await prepareForJev(image);
    const result = await client.decide(
      { image: IMAGE_REF },
      {
        [WHERE]: { type: "box", instructions: `${target} in \`image\`` },
        [PRESENT]: { type: "noul", instructions: `Is ${target} visible in \`image\`?` },
      },
      { [IMAGE_REF]: asset },
    );
    const where = answerOfType(result, WHERE, "box");
    const found: Found = { box: where.box, confidence: where.confidence, presence: answerOfType(result, PRESENT, "noul").noul };
    return { found, model: result.model, inputTokens: result.usage.input_tokens };
  }

  return {
    async locate(images, target) {
      if (images.length === 0 || images.length > MAX_IMAGES) throw new Error(`locate takes 1 to ${MAX_IMAGES} images, got ${images.length}`);
      const started = now();
      const answers = await Promise.all(images.map((image) => locateOne(image, target)));
      return {
        found: answers.map((a) => a.found),
        model: answers[0].model,
        inputTokens: answers.reduce((sum, a) => sum + a.inputTokens, 0),
        latencyMs: now() - started,
      };
    },
  };
}
