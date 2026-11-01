import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadEvidence, outcomes } from "../../src/demo/evidence.ts";

const dir = await mkdtemp(join(tmpdir(), "typecast-evidence-"));
afterAll(() => rm(dir, { recursive: true, force: true }));

const route = (expected: string, choice: string, confidence: number, runnerUp: string) => ({
  expected, choice, confidence, probabilities: { [choice]: confidence, [runnerUp]: 1 - confidence },
});

const run = (data: string, accuracy: number) => JSON.stringify({
  summary: { data, variant: "priority", n: 1, repeats: 1, commit: "c", model: "m", metrics: { accuracy }, perRepeatAccuracy: [], latencyP50: 1, latencyP95: 2, costPer1000Usd: 0, bins: [] },
  results: [route("a", "a", 0.9, "b")],
});

describe("loadEvidence", () => {
  it("keeps the newest run of the variant per data file and ignores everything else", async () => {
    await writeFile(join(dir, "2026-10-31T10-00-00-000Z-priority.json"), run("data/dev.jsonl", 0.5));
    await writeFile(join(dir, "2026-10-31T11-00-00-000Z-priority.json"), run("data/dev.jsonl", 0.9));
    await writeFile(join(dir, "2026-10-31T11-30-00-000Z-baseline.json"), run("data/dev.jsonl", 0.1));
    await writeFile(join(dir, "2026-10-31T09-00-00-000Z-priority.json"), run("data/hard.jsonl", 0.8));
    await writeFile(join(dir, "2026-10-31T12-00-00-000Z-priority.json"), "{ not json");

    const evidence = await loadEvidence(dir, "priority");
    expect(evidence.map((e) => [e.data, e.metrics.accuracy])).toEqual([["data/dev.jsonl", 0.9], ["data/hard.jsonl", 0.8]]);
    expect(evidence[0].outcomes).toEqual({ picked: 1, pickedRight: 1, compared: 0, comparedInShortlist: 0 });
  });

  it("returns nothing when the runs directory doesn't exist", async () => {
    expect(await loadEvidence(join(dir, "missing"), "priority")).toEqual([]);
  });
});

describe("outcomes", () => {
  it("splits routes by the pick line and counts a compare as useful when the label is either of the two shown", () => {
    expect(outcomes([
      route("a", "a", 0.9, "b"),
      route("b", "a", 0.85, "b"),
      route("b", "a", 0.6, "b"),
      route("c", "a", 0.6, "b"),
    ])).toEqual({ picked: 2, pickedRight: 1, compared: 2, comparedInShortlist: 1 });
  });
});
