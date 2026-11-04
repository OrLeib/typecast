import type { JudgedImage } from "./pair-judge.ts";

/** One image's marks. A rubric can skip a criterion that doesn't apply, so `scores` may not have every one. */
export type ImageRating = {
  /** Criterion -> mark, from 0 (worst level) to 1 (best). */
  scores: Record<string, number>;
  /** The marks combined, from 0 to 1. */
  total: number;
  /** The resolved model that rated, e.g. "jev-1.14.0". */
  model: string;
  inputTokens: number;
  latencyMs: number;
};

/** Anything that marks one image against its brief on separate criteria: Jev, a local model, or a test fake. */
export interface ImageRater {
  /** Recorded as `judge` on every rating it makes, e.g. "jev". */
  readonly id: string;
  /** Changes whenever the rubric does, so ratings made under an older rubric are not reused. */
  readonly version: string;
  rate(brief: string, image: JudgedImage): Promise<ImageRating>;
}
