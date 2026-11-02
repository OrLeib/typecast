// Finding a described target in an image. The Jev locator asks once with two questions: a box for where the target is,
// and a noul for whether it is there at all, because a box answer always comes back even when the target is missing.
import { answerOfType } from "../jev/answers.ts";
import type { DecisionClient } from "../jev/client.ts";
import type { Box } from "../jev/parse.ts";
import { prepareForJev } from "./images.ts";

export type Location = {
  box: Box;
  /** How sure the locator is of the box's edges, 0 to 1. */
  confidence: number;
  /** Probability that the target is in the image at all, 0 to 1. */
  presence: number;
  model: string;
  inputTokens: number;
  /** From the request to the answer, retries included. */
  latencyMs: number;
};

/** Anything that finds a target in a PNG or JPEG image: Jev today, a dedicated detector later. */
export interface Locator {
  locate(image: Buffer, target: string): Promise<Location>;
}

/**
 * About one in nine image requests got a 503 ("Image processing is unavailable") while others sent at the same moment
 * answered in under a second (2026-11-01), so a locator's client should retry at once rather than back off for seconds.
 */
export const JEV_LOCATE_RETRIES = { attempts: 4, delayMs: 250 };

/** The image's only name in the request, so the target's description is the only hint at what to find. */
const IMAGE_REF = "asset-image";
const WHERE = "where";
const PRESENT = "present";

export function createJevLocator(client: DecisionClient, { now = () => performance.now() }: { now?: () => number } = {}): Locator {
  return {
    async locate(image, target) {
      const asset = await prepareForJev(image);
      const started = now();
      const result = await client.decide(
        { image: IMAGE_REF },
        {
          [WHERE]: { type: "box", instructions: `${target} in \`image\`` },
          [PRESENT]: { type: "noul", instructions: `Is ${target} visible in \`image\`?` },
        },
        { [IMAGE_REF]: asset },
      );
      const where = answerOfType(result, WHERE, "box");
      return {
        box: where.box,
        confidence: where.confidence,
        presence: answerOfType(result, PRESENT, "noul").noul,
        model: result.model,
        inputTokens: result.usage.input_tokens,
        latencyMs: now() - started,
      };
    },
  };
}
