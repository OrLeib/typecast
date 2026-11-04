// Behaviour every ImageRater must have, so a rating run can take any of them (LSP).
import { describe, expect, it } from "vitest";
import type { ImageRater } from "../../src/judging/image-rater.ts";
import type { JudgedImage } from "../../src/judging/pair-judge.ts";

const image: JudgedImage = { format: "png", data: Buffer.from("IMAGE") };

export function imageRaterContract(name: string, makeRater: () => ImageRater) {
  describe(`${name} honours the ImageRater contract`, () => {
    it("names itself and versions its rubric", () => {
      const rater = makeRater();
      expect(rater.id).toMatch(/\S/);
      expect(rater.version).toMatch(/\S/);
    });

    it("marks an image on at least one criterion, every mark and the total between 0 and 1", async () => {
      const { scores, total } = await makeRater().rate("a red apple", image);
      expect(Object.keys(scores).length).toBeGreaterThan(0);
      for (const mark of [total, ...Object.values(scores)]) {
        expect(mark).toBeGreaterThanOrEqual(0);
        expect(mark).toBeLessThanOrEqual(1);
      }
    });

    it("reports the model, tokens and a non-negative latency", async () => {
      const rating = await makeRater().rate("a red apple", image);
      expect(rating.model).toMatch(/\S/);
      expect(rating.inputTokens).toBeGreaterThanOrEqual(0);
      expect(rating.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
}
