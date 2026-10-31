import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Result } from "./result.ts";
import type { RunMeta, Summary } from "./summary.ts";

export type RunFile = { summary: Summary; results: Result[] };

/** What reading a run guarantees. Older run files predate `Summary.metrics`, so only metadata is promised. */
export type LoadedRun = { summary: RunMeta & { model: string }; results: Result[] };

export async function saveRun(dir: string, run: RunFile, at = new Date()): Promise<string> {
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${at.toISOString().replace(/[:.]/g, "-")}-${run.summary.variant}.json`);
  await writeFile(file, JSON.stringify(run, null, 2));
  return file;
}

export async function loadRun(file: string): Promise<LoadedRun> {
  const run = JSON.parse(await readFile(file, "utf8")) as LoadedRun;
  const resultsOk = Array.isArray(run.results) && run.results.every((r) => typeof r.repeat === "number" && r.probabilities);
  if (!run.summary?.data || !resultsOk) {
    throw new Error(`${file} is not a run file from the current eval (needs summary.data and results with repeat + probabilities)`);
  }
  return run;
}
