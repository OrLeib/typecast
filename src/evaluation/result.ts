import type { ProbPrediction } from "./metrics.ts";

/** One routed brief in one repeat of an eval run. */
export type Result = ProbPrediction & {
  id: string;
  repeat: number;
  latencyMs: number;
  inputTokens: number;
  model: string;
};

export const repeatCount = (results: Result[]) => new Set(results.map((r) => r.repeat)).size;
