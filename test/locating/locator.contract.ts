// Behaviour every Locator must have, so any implementation can stand in for another (LSP).
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { Locator } from "../../src/locating/locator.ts";

export const testImage = (width = 640, height = 480) => sharp({ create: { width, height, channels: 3, background: "#808080" } }).png().toBuffer();

const inRange = (n: number) => {
  expect(n).toBeGreaterThanOrEqual(0);
  expect(n).toBeLessThanOrEqual(1);
};

export function locatorContract(name: string, makeLocator: () => Locator) {
  describe(`${name} honours the Locator contract`, () => {
    it("answers once per image, in order, with ordered edges inside the image and confidences from 0 to 1", async () => {
      const located = await makeLocator().locate([await testImage(), await testImage(300, 300)], "the grey square");
      expect(located.found).toHaveLength(2);
      for (const { box, confidence, presence } of located.found) {
        for (const n of [box.top, box.bottom, box.left, box.right, confidence, presence]) inRange(n);
        expect(box.left).toBeLessThan(box.right);
        expect(box.top).toBeLessThan(box.bottom);
      }
    });

    it("reports the model, token usage and a non-negative latency", async () => {
      const located = await makeLocator().locate([await testImage()], "the grey square");
      expect(located.model).toMatch(/\S/);
      expect(located.inputTokens).toBeGreaterThanOrEqual(0);
      expect(located.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
}
