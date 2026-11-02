// Best-of-N picks over a shootout run: running a PickJudge over every brief, and the append-only file it writes.
import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import type { ShootoutManifest } from "../generation/manifest.ts";
import type { ShootoutItem } from "../generation/shootout.ts";
import { readTextIfAny } from "../shared/files.ts";
import { expectProbabilities, expectProbability, expectString, parseJsonLine } from "../shared/validate.ts";
import { loadImage } from "./pair-judge.ts";
import type { PickJudge, PickVerdict } from "./pick-judge.ts";

/** One judge's pick for one brief, keyed by generator name so it reads without the manifest. */
export type PickRecord = {
  id: string;
  judge: string;
  /** The judge's prompt version: picks made under another prompt are not reused. */
  version: string;
  model: string;
  best: string;
  probabilities: Record<string, number>;
  agreement: number;
  at: string;
};

export const PICKS_FILE = "picks.jsonl";

export type PickRunOptions = { now?: () => Date; onPicked?: (item: ShootoutItem, pick: PickRecord) => void };

/**
 * Picks the best image of every brief this judge has not picked under its current prompt, so an interrupted run
 * resumes where it stopped. Returns the input tokens spent.
 */
export async function pickRun(judge: PickJudge, dir: string, manifest: ShootoutManifest, options: PickRunOptions = {}): Promise<number> {
  const now = options.now ?? (() => new Date());
  const file = join(dir, PICKS_FILE);
  const done = new Set(currentPicks(await loadPicks(file), judge).keys());
  let inputTokens = 0;
  for (const item of manifest.items.filter((i) => !done.has(i.id))) {
    const verdict = await judge.pick({ brief: item.brief, candidates: await Promise.all(item.shots.map((shot) => loadImage(dir, shot.image))) });
    const pick = toRecord(item, verdict, { judge: judge.id, version: judge.version, at: now().toISOString() });
    await appendFile(file, `${JSON.stringify(pick)}\n`);
    inputTokens += verdict.inputTokens;
    options.onPicked?.(item, pick);
  }
  return inputTokens;
}

function toRecord(item: ShootoutItem, verdict: PickVerdict, by: Pick<PickRecord, "judge" | "version" | "at">): PickRecord {
  const generators = item.shots.map((shot) => shot.generator);
  return {
    id: item.id,
    judge: by.judge,
    version: by.version,
    model: verdict.model,
    best: generators[verdict.best],
    probabilities: Object.fromEntries(generators.map((g, i) => [g, verdict.probabilities[i]])),
    agreement: verdict.agreement,
    at: by.at,
  };
}

/** The judge's latest pick per brief, made under its current prompt. */
export function currentPicks(picks: PickRecord[], judge: Pick<PickJudge, "id" | "version">): Map<string, PickRecord> {
  return new Map(picks.filter((p) => p.judge === judge.id && p.version === judge.version).map((p) => [p.id, p]));
}

export async function loadPicks(file: string): Promise<PickRecord[]> {
  const text = await readTextIfAny(file);
  return text.split("\n").flatMap((line, i) => (line.trim() ? [parsePick(parseJsonLine(line, `${file}:${i + 1}`), `${file}:${i + 1}`)] : []));
}

function parsePick(row: Record<string, unknown>, where: string): PickRecord {
  const field = (name: string) => `${where}: ${name}`;
  return {
    id: expectString(row.id, field("id")),
    judge: expectString(row.judge, field("judge")),
    version: expectString(row.version, field("version")),
    model: expectString(row.model, field("model")),
    best: expectString(row.best, field("best")),
    probabilities: expectProbabilities(row.probabilities, field("probabilities")),
    agreement: expectProbability(row.agreement, field("agreement")),
    at: expectString(row.at, field("at")),
  };
}
