import { access, readFile } from "node:fs/promises";
import { parseJsonLine } from "./validate.ts";

export async function fileExists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

/** A text file's contents, or "" when it doesn't exist yet: append-only logs start empty. */
export async function readTextIfAny(file: string): Promise<string> {
  return readFile(file, "utf8").catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return "";
    throw e;
  });
}

/** Every row of a JSONL file that may not exist yet, parsed by `parse`; `where` names the file and line in its errors. */
export async function loadJsonLines<T>(file: string, parse: (row: Record<string, unknown>, where: string) => T): Promise<T[]> {
  const text = await readTextIfAny(file);
  return text.split("\n").flatMap((line, i) => (line.trim() ? [parse(parseJsonLine(line, `${file}:${i + 1}`), `${file}:${i + 1}`)] : []));
}
