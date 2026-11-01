import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Manifest } from "../../src/generation/manifest.ts";
import type { GenerationItem } from "../../src/generation/runner.ts";
import { autoJudgeRun } from "../../src/judging/auto-judge.ts";
import { appendJudgment, JUDGMENTS_FILE, loadJudgments } from "../../src/judging/judgments.ts";
import { createFakeDecisionClient } from "../support/fake-decision-client.ts";

const pair = (id: string, routed: string): GenerationItem => ({
  id, brief: `brief ${id}`, expected: "photo",
  route: { choice: "photo", confidence: 0.9, model: "jev" },
  routed: { generator: routed, image: `images/${id}-${routed}.png`, latencyMs: 1 },
  default: { generator: "dflt", image: `images/${id}-dflt.png`, latencyMs: 1 },
});

const manifest: Manifest = {
  meta: { data: "d", variant: "v", seed: 1, perCategory: 1, defaultGenerator: "dflt", lineup: {}, commit: "c", createdAt: "t" },
  items: [pair("a", "photo"), pair("b", "photo"), pair("same", "dflt"), { ...pair("v", "x"), skipped: "no generator" } as GenerationItem],
};
const now = () => new Date("2026-11-01T12:00:00Z");
let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "typecast-auto-judge-"));
  await mkdir(join(dir, "images"));
  for (const name of ["a-photo", "a-dflt", "b-photo", "b-dflt"]) await writeFile(join(dir, "images", `${name}.png`), name);
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("autoJudgeRun", () => {
  it("judges each pair that differs once, records the model and probabilities, and sums tokens", async () => {
    const client = createFakeDecisionClient(() => ({ choice: "tie", confidence: 0.7 }));
    const tokens = await autoJudgeRun(client, dir, manifest, { now });

    expect(client.calls).toHaveLength(2);
    const sent = Object.values(client.assets[0]!).map((a) => Buffer.from(a.data_base64, "base64").toString()).sort();
    expect(sent).toEqual(["a-dflt", "a-photo"]);
    expect(tokens).toBe(200);
    const [first] = await loadJudgments(join(dir, JUDGMENTS_FILE));
    expect(first).toMatchObject({ id: "a", winner: "tie", judge: "jev", at: "2026-11-01T12:00:00.000Z", model: "fake-1.0.0" });
    expect(first.probabilities!.tie).toBeCloseTo(0.7);
  });

  it("resumes: skips pairs Jev already judged, whatever a human said", async () => {
    const file = join(dir, JUDGMENTS_FILE);
    await appendJudgment(file, { id: "a", winner: "routed", judge: "jev", at: "t" });
    await appendJudgment(file, { id: "b", winner: "routed", judge: "human", at: "t" });
    const client = createFakeDecisionClient(() => ({ choice: "tie", confidence: 0.7 }));
    await autoJudgeRun(client, dir, manifest, { now });
    expect(client.calls).toHaveLength(1);
    expect((await loadJudgments(file)).map((j) => `${j.id}:${j.judge}`)).toEqual(["a:jev", "b:human", "b:jev"]);
  });
});
