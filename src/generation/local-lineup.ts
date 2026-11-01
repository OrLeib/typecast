// Which local mflux model stands in for each placeholder roster category (Level 2).
// A stand-in, not a recommendation: Level 3 replaces it with a real product's models.
import { createMfluxGenerator, type MfluxModel } from "./mflux.ts";
import type { Lineup } from "./runner.ts";

/** 8-bit weights keep the largest model well inside 48GB of unified memory at little quality cost. */
const QUANTIZE = 8;
/**
 * Z-Image (base, not Turbo) needs classifier-free guidance, but its mflux CLI defaults guidance to 0.0, which turns it
 * off and renders washed-out, banded images. 4.0 is the value in mflux's own Z-Image example.
 */
const Z_IMAGE_GUIDANCE = 4;

export const LOCAL_LINEUP: Record<string, MfluxModel> = {
  photoreal: { command: "z-image", quantize: QUANTIZE, guidance: Z_IMAGE_GUIDANCE },
  product: { command: "krea2", quantize: QUANTIZE },
  typography: { command: "qwen-2.1", quantize: QUANTIZE },
  illustration: { command: "anima", quantize: QUANTIZE },
  "fast-draft": { command: "z-image-turbo", quantize: QUANTIZE },
};

/** The single model routing has to beat: the strongest generalist in the lineup. */
const LOCAL_DEFAULT: MfluxModel = LOCAL_LINEUP.typography;

/** The local lineup as generators, ready to render. */
export function createLocalLineup(): Lineup {
  const byCategory = Object.fromEntries(Object.entries(LOCAL_LINEUP).map(([category, model]) => [category, createMfluxGenerator(model)]));
  return { byCategory, fallback: createMfluxGenerator(LOCAL_DEFAULT) };
}
