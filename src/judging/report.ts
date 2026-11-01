import type { GenerationMeta } from "../generation/manifest.ts";
import type { Tally, WinRateSummary } from "./win-rate.ts";

const pct = (x: number) => (Number.isNaN(x) ? "n/a" : `${(x * 100).toFixed(1)}%`);
const counts = (t: Tally) => `${t.wins}W ${t.losses}L ${t.ties}T`;

export function formatWinRate(s: WinRateSummary, meta: GenerationMeta, judge: string): string[] {
  const { overall: o } = s;
  return [
    `${meta.data}  variant=${meta.variant}  seed=${meta.seed}  default=${meta.defaultGenerator}  judge=${judge}  commit=${meta.commit}`,
    `  routed win rate ${pct(o.winRate)}  95% CI [${pct(o.ci[0])}, ${pct(o.ci[1])}]  n=${o.n} (${counts(o)})  sign test p=${o.signTestP.toFixed(3)}`,
    `  not judged: ${s.sameModel} routed to the default model, ${s.skipped} skipped, ${s.unjudged} still to judge`,
    `  mean generation time  routed ${(s.meanLatencyMs.routed / 1000).toFixed(1)}s  default ${(s.meanLatencyMs.default / 1000).toFixed(1)}s`,
    "by routed category:",
    ...Object.entries(s.byCategory).map(([c, t]) => `  ${c.padEnd(14)} ${pct(t.winRate).padStart(6)}  n=${t.n} (${counts(t)})`),
  ];
}
