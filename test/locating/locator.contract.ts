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
    it("returns a box with ordered edges inside the image, and confidences from 0 to 1", async () => {
      const location = await makeLocator().locate(await testImage(), "the grey square");
      const { top, bottom, left, right } = location.box;
      for (const n of [top, bottom, left, right, location.confidence, location.presence]) inRange(n);
      expect(left).toBeLessThan(right);
      expect(top).toBeLessThan(bottom);
    });

    it("reports the model, token usage and a non-negative latency", async () => {
      const location = await makeLocator().locate(await testImage(), "the grey square");
      expect(location.model).toMatch(/\S/);
      expect(location.inputTokens).toBeGreaterThanOrEqual(0);
      expect(location.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
}
