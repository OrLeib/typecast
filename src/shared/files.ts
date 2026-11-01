import { access, readFile } from "node:fs/promises";

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
