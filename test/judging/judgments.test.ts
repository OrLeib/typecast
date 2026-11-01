import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { appendJudgment, latestByPair, loadJudgments, parseJudgments, undoLastJudgment } from "../../src/judging/judgments.ts";

const dir = await mkdtemp(join(tmpdir(), "typecast-judgments-"));
afterAll(() => rm(dir, { recursive: true, force: true }));

describe("judgments store", () => {
  it("appends, reads back, and undoes the last judgment", async () => {
    const file = join(dir, "j.jsonl");
    expect(await loadJudgments(file)).toEqual([]);
    const first = { id: "a", winner: "routed" as const, judge: "human", at: "t1" };
    const second = { id: "b", winner: "tie" as const, judge: "human", at: "t2" };
    await appendJudgment(file, first);
    await appendJudgment(file, second);
    expect(await loadJudgments(file)).toEqual([first, second]);

    expect(await undoLastJudgment(file, "human", new Date("2026-11-01T00:00:00Z"))).toEqual(second);
    expect(await loadJudgments(file)).toEqual([first]);
  });

  it("undoes only the named judge's judgments, by appending", async () => {
    const file = join(dir, "mixed.jsonl");
    const human = { id: "a", winner: "routed" as const, judge: "human", at: "t1" };
    const jev = { id: "a", winner: "tie" as const, judge: "jev", at: "t2" };
    await appendJudgment(file, human);
    await appendJudgment(file, jev);
    await undoLastJudgment(file, "human", new Date("2026-11-01T00:00:00Z"));
    expect(await loadJudgments(file)).toEqual([jev]);
    expect(await undoLastJudgment(file, "human", new Date())).toBeUndefined();
    expect((await readFile(file, "utf8")).trim().split("\n")).toHaveLength(3);
  });

  it("refuses an undo with nothing to take back", () => {
    expect(() => parseJudgments('{"undo":true,"judge":"human","at":"t"}', "j.jsonl")).toThrow(/j.jsonl:1: undo for judge "human" has no judgment/);
  });

  it("names the line of a row that is not JSON", () => {
    expect(() => parseJudgments("{nope", "j.jsonl")).toThrow(/j.jsonl:1: not valid JSON/);
  });

  it("names the line and field of a malformed row", () => {
    expect(() => parseJudgments('{"id":"a","winner":"left","judge":"human","at":"t"}', "j.jsonl")).toThrow(/j.jsonl:1: winner must be one of routed, default, tie/);
  });

  it("keeps one judgment per pair for the chosen judge, the later one winning", () => {
    const latest = latestByPair([
      { id: "a", winner: "routed", judge: "human", at: "1" },
      { id: "a", winner: "default", judge: "clef", at: "2" },
      { id: "a", winner: "tie", judge: "human", at: "3" },
    ], "human");
    expect([...latest.values()]).toEqual([{ id: "a", winner: "tie", judge: "human", at: "3" }]);
  });
});
