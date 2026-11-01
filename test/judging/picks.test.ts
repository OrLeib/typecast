import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createJevPicker } from "../../src/judging/jev-picker.ts";
import type { PickJudge } from "../../src/judging/pick-judge.ts";
import { currentPicks, loadPicks, pickRun, PICKS_FILE, type PickRecord } from "../../src/judging/picks.ts";
import { createFakeDecisionClient } from "../support/fake-decision-client.ts";
import { shootoutOf } from "../support/level2-fixtures.ts";

const manifest = shootoutOf([{ id: "a", choice: "photo" }, { id: "b", choice: "illustration" }]);
const now = () => new Date("2026-11-01T12:00:00Z");
let dir = "";

/** A judge that always picks the candidate whose image bytes are `favourite`. */
const favouring = (favourite: string, version = "v1"): PickJudge => ({
  id: "fake",
  version,
  async pick({ candidates }) {
    const best = candidates.findIndex((c) => c.data.toString().endsWith(favourite));
    const probabilities = candidates.map((_, i) => (i === best ? 0.7 : 0.3 / (candidates.length - 1)));
    return { best, probabilities, agreement: 1, model: "fake-1", inputTokens: 50, latencyMs: 1 };
  },
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "typecast-picks-"));
  await mkdir(join(dir, "images"));
  for (const item of manifest.items) for (const shot of item.shots) await writeFile(join(dir, shot.image), `${item.id}-${shot.generator}`);
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("pickRun", () => {
  it("picks each brief once, sending every image and recording the pick by generator", async () => {
    const tokens = await pickRun(favouring("draw-gen"), dir, manifest, { now });
    expect(tokens).toBe(100);
    const [first] = await loadPicks(join(dir, PICKS_FILE));
    expect(first).toMatchObject({ id: "a", judge: "fake", version: "v1", model: "fake-1", best: "draw-gen", agreement: 1, at: "2026-11-01T12:00:00.000Z" });
    expect(first.probabilities).toEqual({ "photo-gen": 0.15, "draw-gen": 0.7, dflt: 0.15 });
  });

  it("works with the Jev picker end to end", async () => {
    const client = createFakeDecisionClient(() => ({ choice: "image1", confidence: 0.6 }));
    await pickRun(createJevPicker(client), dir, manifest, { now });
    expect(client.calls).toHaveLength(2);
    expect(Object.keys(client.calls[0])).toHaveLength(3);
  });

  it("resumes: skips briefs this judge already picked under the same prompt, and re-picks under a new one", async () => {
    await pickRun(favouring("draw-gen"), dir, shootoutOf([{ id: "a", choice: "photo" }]), { now });
    const seen: string[] = [];
    await pickRun(favouring("dflt"), dir, manifest, { now, onPicked: (item) => void seen.push(item.id) });
    expect(seen).toEqual(["b"]);

    await pickRun(favouring("dflt", "v2"), dir, manifest, { now });
    const latest = currentPicks(await loadPicks(join(dir, PICKS_FILE)), { id: "fake", version: "v2" });
    expect([...latest.values()].map((p) => p.best)).toEqual(["dflt", "dflt"]);
  });
});

describe("loadPicks", () => {
  it("reads a missing file as no picks", async () => {
    expect(await loadPicks(join(dir, PICKS_FILE))).toEqual([]);
  });

  it("names the line and field of a malformed pick", async () => {
    const pick: PickRecord = { id: "a", judge: "j", version: "v", model: "m", best: "g", probabilities: { g: 1 }, agreement: 1, at: "t" };
    await appendFile(join(dir, PICKS_FILE), `${JSON.stringify(pick)}\n${JSON.stringify({ ...pick, agreement: 2 })}\n`);
    await expect(loadPicks(join(dir, PICKS_FILE))).rejects.toThrow(/picks.jsonl:2: agreement must be between 0 and 1, got 2/);
  });
});
