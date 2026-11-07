import type { HomeStory } from "../../src/demo/home-stories.ts";
import type { ShootoutBrief, ShootoutEvidence } from "../../src/demo/shootout-evidence.ts";

const shot = (generator: string, picked = false) => ({ generator, url: `/${generator}.jpg`, probability: 0.2, picked });

export function story(label: string, confidence: number, routedGenerator: string, best: string): HomeStory {
  const shots = ["a", "b", "c"].map((generator) => shot(generator, generator === best));
  const brief: ShootoutBrief = { id: label, brief: `brief <${label}>`, expected: "photo", routed: "photo", confidence, routedGenerator, agreement: 1, split: false, shots };
  const reason = { category: "photo", label: "Real-world scene", probability: 0.9 };
  return {
    brief, label, target: `the <${label}>`, box: { top: 0.4, bottom: 0.6, left: 0.4, right: 0.6 },
    confidence, explanation: confidence < 0.85 ? { because: [], open: [reason, { ...reason, label: "Words must be readable" }] } : { because: [reason], open: [] },
    best: shots.find((s) => s.picked)!, routed: shots.find((s) => s.generator === routedGenerator),
    second: confidence < 0.85 ? shots.find((s) => s.generator === "c") : undefined,
  };
}

export const shootoutOf = (briefs: ShootoutBrief[], defaultGenerator: string): ShootoutEvidence => ({
  run: "r", data: "data/dev.jsonl", defaultGenerator, lineup: {}, picked: briefs.length, models: 3, meanAgreement: 0.8,
  bestWas: { routed: 0.5, expected: 0.5, default: 0.25 }, briefs,
});
