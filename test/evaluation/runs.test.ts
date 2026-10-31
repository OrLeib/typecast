import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadRun, saveRun } from "../../src/evaluation/runs.ts";
import { summarize } from "../../src/evaluation/summary.ts";

const dir = await mkdtemp(join(tmpdir(), "typecast-runs-"));
afterAll(() => rm(dir, { recursive: true, force: true }));

describe("run store", () => {
  it("round-trips a run under a timestamped, variant-named file", async () => {
    const results = [{ id: "a", repeat: 0, expected: "x", choice: "x", confidence: 1, probabilities: { x: 1 }, latencyMs: 1, inputTokens: 1, model: "m" }];
    const summary = summarize(results, [{ id: "a", brief: "b", expected: "x" }], { data: "d", variant: "baseline", repeats: 1, commit: "c" }, 0);
    const file = await saveRun(dir, { summary, results }, new Date("2026-10-31T12:00:00.000Z"));

    expect(file).toBe(join(dir, "2026-10-31T12-00-00-000Z-baseline.json"));
    expect(await loadRun(file)).toEqual({ summary, results });
  });

  it("rejects files that are not current run files", async () => {
    const file = join(dir, "old.json");
    await writeFile(file, JSON.stringify({ summary: { data: "d" }, results: [{ id: "a" }] }));
    await expect(loadRun(file)).rejects.toThrow(/not a run file/);
  });
});
