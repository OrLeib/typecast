import { readFile } from "node:fs/promises";
import type { ProbPrediction } from "./metrics.ts";

export type Result = ProbPrediction & { id: string; repeat: number; latencyMs: number; inputTokens: number; model: string };

export type RunFile = {
  summary: { data: string; variant: string; repeats: number; commit: string; model: string } & Record<string, unknown>;
  results: Result[];
};

export async function loadRun(file: string): Promise<RunFile> {
  const run = JSON.parse(await readFile(file, "utf8")) as RunFile;
  if (!run.summary?.data || !Array.isArray(run.results) || run.results.some((r) => typeof r.repeat !== "number" || !r.probabilities)) {
    throw new Error(`${file} is not a run file from the current eval (needs summary.data and results with repeat + probabilities)`);
  }
  return run;
}
