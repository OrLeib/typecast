import { readFile } from "node:fs/promises";
import { parseJsonLine } from "../shared/validate.ts";

export type Brief = { id: string; brief: string; expected: string; note?: string };

/** A brief with a `note` was labelled as deliberately borderline. */
export const isBorderline = (b: Brief) => b.note !== undefined;

const BRIEF_FIELDS = new Set(["id", "brief", "expected", "note"]);

export async function loadBriefs(file: string): Promise<Brief[]> {
  return parseBriefs(await readFile(file, "utf8"), file);
}

/** Parses JSONL briefs, throwing with `source:line` and the offending field on any malformed row. */
export function parseBriefs(jsonl: string, source: string): Brief[] {
  return jsonl.split("\n").flatMap((line, i) => (line.trim() ? [parseBrief(line, `${source}:${i + 1}`)] : []));
}

function parseBrief(line: string, where: string): Brief {
  const fields = parseJsonLine(line, where);
  const unknown = Object.keys(fields).filter((k) => !BRIEF_FIELDS.has(k));
  if (unknown.length) throw new Error(`${where}: unknown field(s) ${unknown.join(", ")}`);
  const text = (field: string) => {
    const value = fields[field];
    if (typeof value !== "string" || !value.trim()) throw new Error(`${where}: ${field} must be a non-empty string`);
    return value;
  };
  const brief: Brief = { id: text("id"), brief: text("brief"), expected: text("expected") };
  if ("note" in fields) brief.note = text("note");
  return brief;
}
