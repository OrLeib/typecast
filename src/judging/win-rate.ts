import { bootstrapCI, mcnemarExact } from "../shared/stats.ts";
import { isPair, type GenerationItem } from "../generation/runner.ts";
import type { Judgment } from "./judgments.ts";
import { needsJudging } from "./pairs.ts";

export type Tally = { n: number; wins: number; losses: number; ties: number; winRate: number };

export type WinRateSummary = {
  /** Pairs where routing picked a different model than the default, and a judge decided. */
  overall: Tally & { ci: [number, number]; signTestP: number };
  byCategory: Record<string, Tally>;
  /** Routed to the default model itself: identical images, so not judged. */
  sameModel: number;
  /** Routed to a category with no generator (e.g. video). */
  skipped: number;
  unjudged: number;
  meanLatencyMs: { routed: number; default: number };
};

/** Score of one judged pair: a win counts 1, a tie half. */
const score = (j: Judgment) => (j.winner === "routed" ? 1 : j.winner === "tie" ? 0.5 : 0);

export function tally(judgments: Judgment[]): Tally {
  const wins = judgments.filter((j) => j.winner === "routed").length;
  const losses = judgments.filter((j) => j.winner === "default").length;
  const n = judgments.length;
  return { n, wins, losses, ties: n - wins - losses, winRate: n ? judgments.reduce((s, j) => s + score(j), 0) / n : NaN };
}

/**
 * Routed-model win rate against the default model, counting ties as half a win, with a bootstrap 95% CI
 * over pairs and an exact sign test on wins vs losses (ties carry no direction, so they drop out).
 */
export function summarizeWinRate(items: GenerationItem[], judgments: Map<string, Judgment>): WinRateSummary {
  const toJudge = items.filter(needsJudging);
  const judged = toJudge.flatMap((item) => {
    const judgment = judgments.get(item.id);
    return judgment ? [{ item, judgment }] : [];
  });
  const overall = tally(judged.map((x) => x.judgment));
  const categories = [...new Set(judged.map((x) => x.item.route.choice))].sort();
  const pairs = items.filter(isPair);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  return {
    overall: {
      ...overall,
      // With nothing judged there is no rate to bracket; NaN prints as n/a instead of a confident-looking [0%, 0%].
      ci: judged.length ? bootstrapCI(judged.map((x) => x.judgment), (sample) => tally(sample).winRate) : [NaN, NaN],
      signTestP: mcnemarExact(overall.wins, overall.losses),
    },
    byCategory: Object.fromEntries(categories.map((c) => [c, tally(judged.filter((x) => x.item.route.choice === c).map((x) => x.judgment))])),
    sameModel: pairs.length - toJudge.length,
    skipped: items.length - pairs.length,
    unjudged: toJudge.length - judged.length,
    meanLatencyMs: { routed: mean(pairs.map((p) => p.routed.latencyMs)), default: mean(pairs.map((p) => p.default.latencyMs)) },
  };
}
