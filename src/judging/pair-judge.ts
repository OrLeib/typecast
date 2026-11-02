import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { Winner } from "./judgments.ts";

/** A rendered image, as raw bytes. */
export type JudgedImage = { format: "png" | "jpeg"; data: Buffer };

const FORMATS: Record<string, JudgedImage["format"]> = { ".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg" };

/** Reads a run's image, `relative` to its directory, for a judge. */
export async function loadImage(dir: string, relative: string): Promise<JudgedImage> {
  const format = FORMATS[extname(relative).toLowerCase()];
  if (!format) throw new Error(`${relative}: judges take PNG or JPEG images only`);
  return { format, data: await readFile(join(dir, relative)) };
}

/** A brief and the two images made for it: by the routed model and by the default model. */
export type JudgedPair = { brief: string; routed: JudgedImage; default: JudgedImage };

export type PairVerdict = {
  winner: Winner;
  /** Each outcome's probability, as the judge reports it. */
  probabilities: Record<Winner, number>;
  /** The resolved model that judged, e.g. "jev-1.14.0". */
  model: string;
  inputTokens: number;
  latencyMs: number;
};

/** Anything that decides which image of a pair fulfils its brief better: Jev, a local model, or a test fake. */
export interface PairJudge {
  /** Recorded as `judge` on every judgment it makes, e.g. "jev". */
  readonly id: string;
  /** Changes whenever the judge's prompt does, so verdicts cached under an older prompt are not reused. */
  readonly version: string;
  judge(pair: JudgedPair): Promise<PairVerdict>;
}
