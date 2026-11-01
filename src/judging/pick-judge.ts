import type { JudgedImage } from "./pair-judge.ts";

/** A brief and the images made for it, in no meaningful order: several models, seeds or prompt variants. */
export type CandidateSet = { brief: string; candidates: JudgedImage[] };

export type PickVerdict = {
  /** Index into the set's candidates of the image that fulfils the brief best. */
  best: number;
  /** Each candidate's probability of being the best, in candidate order. */
  probabilities: number[];
  /** Share of the judge's separate looks at the set (e.g. one per ordering) that chose `best`: 1 means it never wavered. */
  agreement: number;
  /** The resolved model that judged, e.g. "jev-1.14.0". */
  model: string;
  inputTokens: number;
  latencyMs: number;
};

/** Anything that picks the image of a set that fulfils its brief best: Jev, a local model, or a test fake. */
export interface PickJudge {
  /** Recorded as `judge` on every pick it makes, e.g. "jev". */
  readonly id: string;
  /** Changes whenever the judge's prompt does, so picks made under an older prompt are not reused. */
  readonly version: string;
  pick(set: CandidateSet): Promise<PickVerdict>;
}
