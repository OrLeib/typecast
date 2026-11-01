import { appendFile, readFile, writeFile } from "node:fs/promises";

/** Which image won a pair. A tie means no preference, not "both bad". */
export type Winner = "routed" | "default" | "tie";

/** `judge` names who decided: "human" for hand judging, or an auto-judge's model id. */
export type Judgment = { id: string; winner: Winner; judge: string; at: string };

export const JUDGMENTS_FILE = "judgments.jsonl";

const WINNERS: readonly Winner[] = ["routed", "default", "tie"];

/** Parses JSONL judgments, throwing with `source:line` and the offending field on any malformed row. */
export function parseJudgments(jsonl: string, source: string): Judgment[] {
  return jsonl.split("\n").flatMap((line, i) => {
    if (!line.trim()) return [];
    const where = `${source}:${i + 1}`;
    const row = JSON.parse(line) as Partial<Judgment>;
    if (typeof row.id !== "string" || !row.id) throw new Error(`${where}: id must be a non-empty string`);
    if (!WINNERS.includes(row.winner as Winner)) throw new Error(`${where}: winner must be one of ${WINNERS.join(", ")}`);
    if (typeof row.judge !== "string" || !row.judge) throw new Error(`${where}: judge must be a non-empty string`);
    if (typeof row.at !== "string") throw new Error(`${where}: at must be a timestamp string`);
    return [row as Judgment];
  });
}

export async function loadJudgments(file: string): Promise<Judgment[]> {
  const text = await readFile(file, "utf8").catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return "";
    throw e;
  });
  return parseJudgments(text, file);
}

export async function appendJudgment(file: string, judgment: Judgment): Promise<void> {
  await appendFile(file, `${JSON.stringify(judgment)}\n`);
}

/** Removes the most recent judgment, for undoing a misclick. Returns it, or undefined if there was none. */
export async function removeLastJudgment(file: string): Promise<Judgment | undefined> {
  const judgments = await loadJudgments(file);
  const last = judgments.pop();
  if (last) await writeFile(file, judgments.map((j) => `${JSON.stringify(j)}\n`).join(""));
  return last;
}

/** One judgment per pair for one judge. If a pair was judged twice, the later one counts. */
export function latestByPair(judgments: Judgment[], judge: string): Map<string, Judgment> {
  return new Map(judgments.filter((j) => j.judge === judge).map((j) => [j.id, j]));
}
