import { describe, expect, it } from "vitest";
import { JevHttpError, type DecisionClient, type DecisionResult } from "../../src/jev/client.ts";
import { withRetries } from "../../src/jev/retry.ts";

const ok: DecisionResult = { model: "jev-test", answers: {}, usage: { input_tokens: 1, output_tokens: 1 }, latencyMs: 1 };

/** Fails with each error in turn, then answers. */
function flaky(...errors: Error[]): DecisionClient & { calls: number } {
  const client = {
    calls: 0,
    async decide() {
      client.calls++;
      const error = errors.shift();
      if (error) throw error;
      return ok;
    },
  };
  return client;
}

describe("withRetries", () => {
  it("retries outages and network failures with growing waits, then answers", async () => {
    const waits: number[] = [];
    const client = flaky(new JevHttpError(503, { detail: "unavailable" }), new TypeError("fetch failed"));
    const result = await withRetries(client, { attempts: 3, delayMs: 100, sleep: async (ms) => void waits.push(ms) }).decide("x", {});
    expect(result).toBe(ok);
    expect(waits).toEqual([100, 200]);
  });

  it("fails at once on a bad request", async () => {
    const client = flaky(new JevHttpError(400, { detail: "bad image" }));
    await expect(withRetries(client, { attempts: 3, delayMs: 0, sleep: async () => {} }).decide("x", {})).rejects.toThrow(/Jev 400/);
    expect(client.calls).toBe(1);
  });

  it("gives up after the last attempt with that attempt's error", async () => {
    const client = flaky(new JevHttpError(503, 1), new JevHttpError(502, 2), new JevHttpError(500, 3));
    await expect(withRetries(client, { attempts: 2, delayMs: 0, sleep: async () => {} }).decide("x", {})).rejects.toMatchObject({ status: 502 });
  });
});
