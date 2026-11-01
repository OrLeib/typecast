import type { GenerationMeta } from "../generation/manifest.ts";
import type { Agreement } from "./agreement.ts";
import { percent as pct } from "../shared/format.ts";
import type { PickSummary } from "./pick-summary.ts";
import type { Tally, WinRateSummary } from "./win-rate.ts";

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

export function formatAgreement(a: Agreement, judge: string, other: string): string {
  return `  ${judge} agrees with ${other} on ${a.agree}/${a.n} pairs (${pct(a.rate)}), opposite calls ${a.opposite}`;
}

export function formatPickSummary(s: PickSummary, meta: GenerationMeta, judge: string): string[] {
  const chance = pct(1 / s.models);
  return [
    `${meta.data}  variant=${meta.variant}  seed=${meta.seed}  models=${s.models}  judge=${judge}  commit=${meta.commit}`,
    `  best image came from  the routed model ${pct(s.bestWas.routed)}  the expected category's model ${pct(s.bestWas.expected)}  the default ${pct(s.bestWas.default)}  (chance ${chance})`,
    `  n=${s.picked}${s.unpicked ? `, ${s.unpicked} still to pick` : ""}  mean agreement across orders ${pct(s.meanAgreement)}  mean top probability ${pct(s.meanTopProbability)}`,
    "by model:",
    ...Object.entries(s.byGenerator).map(([g, t]) => `  ${g.padEnd(24)} picked ${String(t.picked).padStart(3)}  mean probability ${pct(t.meanProbability).padStart(6)}`),
  ];
}
