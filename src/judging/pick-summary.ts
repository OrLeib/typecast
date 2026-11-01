// What a judge's best-of-N picks over a shootout say: how often the routed model made the best image, against chance.
import type { ShootoutManifest } from "../generation/manifest.ts";
import type { PickRecord } from "./picks.ts";

export type PickSummary = {
  picked: number;
  unpicked: number;
  /** Models per brief, so 1 / models is what a random pick would score. */
  models: number;
  /** Share of picked briefs whose best image came from the model routing chose, the expected category's model, or the default. */
  bestWas: { routed: number; expected: number; default: number };
  /** Mean share of the judge's looks that agreed with its pick, and mean probability of the picked image. */
  meanAgreement: number;
  meanTopProbability: number;
  byGenerator: Record<string, { picked: number; meanProbability: number }>;
};

export function summarizePicks({ meta, items }: ShootoutManifest, picks: Map<string, PickRecord>): PickSummary {
  const judged = items.flatMap((item) => {
    const pick = picks.get(item.id);
    return pick ? [{ item, pick }] : [];
  });
  const share = (hit: (x: (typeof judged)[number]) => boolean) => judged.filter(hit).length / judged.length;
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const generators = [...new Set(items.flatMap((item) => item.shots.map((shot) => shot.generator)))];
  return {
    picked: judged.length,
    unpicked: items.length - judged.length,
    models: generators.length,
    bestWas: {
      routed: share(({ item, pick }) => pick.best === meta.lineup[item.route.choice]),
      expected: share(({ item, pick }) => pick.best === meta.lineup[item.expected]),
      default: share(({ pick }) => pick.best === meta.defaultGenerator),
    },
    meanAgreement: mean(judged.map(({ pick }) => pick.agreement)),
    meanTopProbability: mean(judged.map(({ pick }) => pick.probabilities[pick.best])),
    byGenerator: Object.fromEntries(generators.map((g) => [g, {
      picked: judged.filter(({ pick }) => pick.best === g).length,
      meanProbability: mean(judged.map(({ pick }) => pick.probabilities[g] ?? 0)),
    }])),
  };
}
