import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expectArray, expectNumber, expectProbabilities, expectProbability, expectRecord, expectString, withSource } from "../shared/validate.ts";
import type { Reason } from "../routing/reasons.ts";
import type { Result } from "./result.ts";
import type { RunMeta, Summary } from "./summary.ts";

export type RunFile = { summary: Summary; results: Result[] };

/** What reading a run guarantees. Older run files predate `Summary.metrics` and `reasons`, so only metadata is promised, and reasons default to none. */
export type LoadedRun = { summary: RunMeta & { model: string }; results: Result[] };

export async function saveRun(dir: string, run: RunFile, at = new Date()): Promise<string> {
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${at.toISOString().replace(/[:.]/g, "-")}-${run.summary.variant}.json`);
  await writeFile(file, JSON.stringify(run, null, 2));
  return file;
}

/** Reads a run file, throwing with the file and the offending field when it is not one the current eval wrote. */
export async function loadRun(file: string): Promise<LoadedRun> {
  const text = await readFile(file, "utf8");
  return withSource(`${file} is not a run file from the current eval`, () => parseRun(JSON.parse(text)));
}

function parseRun(raw: unknown): LoadedRun {
  const run = expectRecord(raw, "run");
  const summary = expectRecord(run.summary, "summary");
  // Checked, then kept whole: a newer summary carries more fields than this guarantees, and they pass through.
  expectString(summary.data, "summary.data");
  expectString(summary.variant, "summary.variant");
  expectNumber(summary.repeats, "summary.repeats");
  expectString(summary.commit, "summary.commit");
  expectString(summary.model, "summary.model");
  const results = expectArray(run.results, "results").map((r, i) => parseResult(r, `results[${i}]`));
  return { summary: summary as LoadedRun["summary"], results };
}

function parseResult(raw: unknown, path: string): Result {
  const r = expectRecord(raw, path);
  return {
    id: expectString(r.id, `${path}.id`),
    repeat: expectNumber(r.repeat, `${path}.repeat`),
    expected: expectString(r.expected, `${path}.expected`),
    choice: expectString(r.choice, `${path}.choice`),
    confidence: expectProbability(r.confidence, `${path}.confidence`),
    probabilities: expectProbabilities(r.probabilities, `${path}.probabilities`),
    reasons: expectArray(r.reasons ?? [], `${path}.reasons`).map((reason, i) => parseReason(reason, `${path}.reasons[${i}]`)),
    latencyMs: expectNumber(r.latencyMs, `${path}.latencyMs`),
    inputTokens: expectNumber(r.inputTokens, `${path}.inputTokens`),
    model: expectString(r.model, `${path}.model`),
  };
}

function parseReason(raw: unknown, path: string): Reason {
  const reason = expectRecord(raw, path);
  return {
    category: expectString(reason.category, `${path}.category`),
    label: expectString(reason.label, `${path}.label`),
    probability: expectProbability(reason.probability, `${path}.probability`),
  };
}
