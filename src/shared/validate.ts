// Field checks for JSON read from disk or the wire. Each throws naming the path of the offending field;
// callers prefix where the JSON came from.

export function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${path} must be an object`);
  return value as Record<string, unknown>;
}

export function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return value;
}

export function expectString(value: unknown, path: string): string {
  if (typeof value !== "string") throw new Error(`${path} must be a string`);
  return value;
}

export function expectNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${path} must be a number`);
  return value;
}

export function expectProbability(value: unknown, path: string): number {
  const p = expectNumber(value, path);
  if (p < 0 || p > 1) throw new Error(`${path} must be between 0 and 1, got ${p}`);
  return p;
}

/** Every value of a record as a probability. */
export function expectProbabilities(value: unknown, path: string): Record<string, number> {
  const record = expectRecord(value, path);
  return Object.fromEntries(Object.entries(record).map(([key, p]) => [key, expectProbability(p, `${path}.${key}`)]));
}

/** One line of JSONL as an object, throwing with `where` when it is not JSON or not an object. */
export function parseJsonLine(line: string, where: string): Record<string, unknown> {
  let row: unknown;
  try {
    row = JSON.parse(line);
  } catch (e) {
    throw new Error(`${where}: not valid JSON (${(e as Error).message})`);
  }
  if (typeof row !== "object" || row === null || Array.isArray(row)) throw new Error(`${where}: must be a JSON object`);
  return row as Record<string, unknown>;
}

/** Runs `parse`, prefixing any error with where the JSON came from. */
export function withSource<T>(source: string, parse: () => T): T {
  try {
    return parse();
  } catch (e) {
    throw new Error(`${source}: ${(e as Error).message}`);
  }
}
