import { readFile } from "node:fs/promises";

export type Brief = { id: string; brief: string; expected: string; note?: string };

/** A brief with a `note` was labelled as deliberately borderline. */
export const isBorderline = (b: Brief) => b.note !== undefined;

export async function loadBriefs(file: string): Promise<Brief[]> {
  return (await readFile(file, "utf8"))
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Brief);
}
