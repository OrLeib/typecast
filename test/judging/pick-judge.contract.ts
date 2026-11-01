// Behaviour every PickJudge must have, so a pick run can take any of them (LSP).
import { describe, expect, it } from "vitest";
import type { JudgedImage } from "../../src/judging/pair-judge.ts";
import type { PickJudge } from "../../src/judging/pick-judge.ts";

const image = (data: string): JudgedImage => ({ format: "png", data: Buffer.from(data) });
const set = (count: number) => ({ brief: "a red apple", candidates: Array.from({ length: count }, (_, i) => image(`IMAGE-${i}`)) });

export function pickJudgeContract(name: string, makeJudge: () => PickJudge) {
  describe(`${name} honours the PickJudge contract`, () => {
    it("names itself and versions its prompt", () => {
      const judge = makeJudge();
      expect(judge.id).toMatch(/\S/);
      expect(judge.version).toMatch(/\S/);
    });

    it.each([2, 5])("picks one of %i candidates, with one probability per candidate", async (count) => {
      const verdict = await makeJudge().pick(set(count));
      expect(verdict.best).toBeGreaterThanOrEqual(0);
      expect(verdict.best).toBeLessThan(count);
      expect(verdict.probabilities).toHaveLength(count);
      for (const p of [...verdict.probabilities, verdict.agreement]) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
      expect(verdict.probabilities.reduce((a, b) => a + b)).toBeCloseTo(1);
    });

    it("reports the model, tokens and a non-negative latency", async () => {
      const verdict = await makeJudge().pick(set(3));
      expect(verdict.model).toMatch(/\S/);
      expect(verdict.inputTokens).toBeGreaterThanOrEqual(0);
      expect(verdict.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("refuses a set with nothing to choose between", async () => {
      await expect(makeJudge().pick(set(1))).rejects.toThrow(/at least 2 candidates/);
    });
  });
}
