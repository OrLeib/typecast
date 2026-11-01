// Behaviour every Router must have, so evaluation and the demo can take any of them (LSP).
import { describe, expect, it } from "vitest";
import type { Router } from "../../src/routing/router.ts";

export function routerContract(name: string, roster: Record<string, string>, makeRouter: () => Router) {
  describe(`${name} honours the Router contract`, () => {
    it("chooses a roster category, with one probability per category", async () => {
      const route = await makeRouter().route("a looping clip of a lighthouse");
      const categories = Object.keys(roster).sort();
      expect(categories).toContain(route.choice);
      expect(Object.keys(route.probabilities).sort()).toEqual(categories);
      for (const p of [route.confidence, ...Object.values(route.probabilities)]) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    });

    it("reports the model, tokens and a non-negative latency", async () => {
      const route = await makeRouter().route("a brief");
      expect(route.model).toMatch(/\S/);
      expect(route.inputTokens).toBeGreaterThanOrEqual(0);
      expect(route.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
}
