import { appendFile } from "node:fs/promises";
import { readTextIfAny } from "../shared/files.ts";
import { parseJsonLine } from "../shared/validate.ts";

/** Which image won a pair. A tie means no preference, not "both bad". */
export type Winner = "routed" | "default" | "tie";

/**
 * `judge` names who decided: HUMAN_JUDGE for hand judging, or an auto-judge's id (see PairJudge). An auto-judge also
 * records its resolved `model` version and its `probabilities` for each outcome.
 */
export type Judgment = { id: string; winner: Winner; judge: string; at: string; model?: string; probabilities?: Record<Winner, number> };

export const HUMAN_JUDGE = "human";

export const JUDGMENTS_FILE = "judgments.jsonl";

const WINNERS: readonly Winner[] = ["routed", "default", "tie"];

/**
 * A row that takes back its judge's latest standing judgment. Undo appends one instead of rewriting the file, so a
 * judge writing to the same file at the same time (a person in the judging page while Jev runs) loses nothing.
 */
type Undo = { undo: true; judge: string; at: string };

/**
 * Parses JSONL judgments and applies undo rows, throwing with `source:line` and the offending field on any malformed
 * row. Returns the judgments still standing, in file order.
 */
export function parseJudgments(jsonl: string, source: string): Judgment[] {
  const standing: (Judgment | undefined)[] = [];
  jsonl.split("\n").forEach((line, i) => {
    if (!line.trim()) return;
    const where = `${source}:${i + 1}`;
    const row = parseJsonLine(line, where) as Partial<Judgment & Undo>;
    if (typeof row.judge !== "string" || !row.judge) throw new Error(`${where}: judge must be a non-empty string`);
    if (typeof row.at !== "string") throw new Error(`${where}: at must be a timestamp string`);
    if (row.undo === true) {
      const last = standing.findLastIndex((j) => j?.judge === row.judge);
      if (last === -1) throw new Error(`${where}: undo for judge "${row.judge}" has no judgment to take back`);
      standing[last] = undefined;
      return;
    }
    if (typeof row.id !== "string" || !row.id) throw new Error(`${where}: id must be a non-empty string`);
    if (!WINNERS.includes(row.winner as Winner)) throw new Error(`${where}: winner must be one of ${WINNERS.join(", ")}`);
    standing.push(row as Judgment);
  });
  return standing.filter((j) => j !== undefined);
}

export async function loadJudgments(file: string): Promise<Judgment[]> {
  return parseJudgments(await readTextIfAny(file), file);
}

export async function appendJudgment(file: string, judgment: Judgment): Promise<void> {
  await appendFile(file, `${JSON.stringify(judgment)}\n`);
}

/** Takes back `judge`'s most recent standing judgment, for undoing a misclick. Returns it, or undefined if there was none. */
export async function undoLastJudgment(file: string, judge: string, at: Date): Promise<Judgment | undefined> {
  const last = (await loadJudgments(file)).findLast((j) => j.judge === judge);
  if (last) await appendFile(file, `${JSON.stringify({ undo: true, judge, at: at.toISOString() } satisfies Undo)}\n`);
  return last;
}

/** One judgment per pair for one judge. If a pair was judged twice, the later one counts. */
export function latestByPair(judgments: Judgment[], judge: string): Map<string, Judgment> {
  return new Map(judgments.filter((j) => j.judge === judge).map((j) => [j.id, j]));
}
