import { describe, expect, it } from "vitest";
import type { GenerationItem } from "../../src/generation/runner.ts";
import type { Judgment, Winner } from "../../src/judging/judgments.ts";
import { summarizeWinRate, tally } from "../../src/judging/win-rate.ts";

const judgment = (id: string, winner: Winner): Judgment => ({ id, winner, judge: "human", at: "t" });

const pair = (id: string, choice: string, routed = "m-" + choice): GenerationItem => ({
  id, brief: id, expected: choice,
  route: { choice, confidence: 0.9, model: "jev" },
  routed: { generator: routed, image: `${id}-r.png`, latencyMs: 2000 },
  default: { generator: "m-default", image: `${id}-d.png`, latencyMs: 6000 },
});

describe("tally", () => {
  it("counts a tie as half a win", () => {
    expect(tally([judgment("a", "routed"), judgment("b", "default"), judgment("c", "tie"), judgment("d", "routed")]))
      .toEqual({ n: 4, wins: 2, losses: 1, ties: 1, winRate: 0.625 });
  });

  it("has no win rate without judgments", () => {
    expect(tally([]).winRate).toBeNaN();
  });
});

describe("summarizeWinRate", () => {
  it("judges only pairs where routing picked a different model, and breaks them down by routed category", () => {
    const items: GenerationItem[] = [
      pair("a", "photo"), pair("b", "photo"), pair("c", "art"), pair("d", "art"),
      pair("same", "text", "m-default"),
      { id: "v", brief: "v", expected: "video", route: { choice: "video", confidence: 1, model: "jev" }, skipped: "no generator" },
    ];
    const judgments = new Map([["a", judgment("a", "routed")], ["b", judgment("b", "routed")], ["c", judgment("c", "default")], ["same", judgment("same", "default")]]);

    const s = summarizeWinRate(items, judgments);

    expect(s.overall).toMatchObject({ n: 3, wins: 2, losses: 1, ties: 0 });
    expect(s.overall.winRate).toBeCloseTo(2 / 3);
    expect(s.overall.signTestP).toBe(1);
    expect(s.byCategory).toEqual({ art: { n: 1, wins: 0, losses: 1, ties: 0, winRate: 0 }, photo: { n: 2, wins: 2, losses: 0, ties: 0, winRate: 1 } });
    expect(s).toMatchObject({ sameModel: 1, skipped: 1, unjudged: 1, meanLatencyMs: { routed: 2000, default: 6000 } });
  });

  it("brackets the win rate with a bootstrap CI", () => {
    const items = Array.from({ length: 20 }, (_, i) => pair(`p${i}`, "photo"));
    const judgments = new Map(items.map((item, i) => [item.id, judgment(item.id, i < 15 ? "routed" : "default")]));
    const { overall } = summarizeWinRate(items, judgments);
    expect(overall.winRate).toBe(0.75);
    expect(overall.ci[0]).toBeLessThan(0.75);
    expect(overall.ci[1]).toBeGreaterThan(0.75);
    expect(overall.signTestP).toBeLessThan(0.05);
  });

  it("has no win rate or CI before anything is judged", () => {
    const { overall } = summarizeWinRate([pair("a", "photo")], new Map());
    expect(overall.n).toBe(0);
    expect(overall.winRate).toBeNaN();
    expect(overall.ci).toEqual([NaN, NaN]);
  });
});
