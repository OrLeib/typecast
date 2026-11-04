import { REASON_CHECKS, type ReasonCheck } from "./reasons.ts";
import { ROSTER } from "./roster.ts";

/** A routing configuration under test: the question instructions plus the roster descriptions. */
export type Variant = { instructions: string; roster: Record<string, string>; reasons?: Record<string, ReasonCheck> };

/** Spells out which requirement outranks which, in the order the labelling rules use. */
const priority: Variant = {
  instructions:
    "Pick the category for the brief's hardest requirement, checking in this order: " +
    "(1) must the output move? " +
    "(2) does the user explicitly put speed, cost or volume ahead of quality? " +
    "(3) must specific words be readable in the final image? " +
    "Only if none apply, choose by subject and setting. " +
    "Style words like 'cinematic', 'painterly' or 'animated look' describe appearance, not the output type.",
  roster: {
    ...ROSTER,
    typography:
      "Specific words must be readable in the final image (titles, headlines, brand names, signs, labels, captions), " +
      "whatever the subject or style. Not when text will be added later in layout.",
    "fast-draft":
      "The user explicitly prioritizes speed, cost or volume over quality " +
      "(rough, quick, placeholder, many variations, preview before spending), whatever the subject.",
    video: "The output itself must move: clips, loops, animations, GIFs, cinemagraphs. Not stills that only look cinematic or animated.",
  },
};

export const VARIANTS: Record<string, Variant> = {
  baseline: {
    instructions: "Which image or video model category best fits this creative brief?",
    roster: ROSTER,
  },
  priority,
  /** The same choice as `priority`, with the yes/no checks that say why alongside it. */
  explained: { ...priority, reasons: REASON_CHECKS },
};

/** The variant routes use unless told otherwise. `priority` beat baseline on held-out briefs on 2026-10-31; `explained` asks it the same question. */
export const DEFAULT_VARIANT = "explained";

export function getVariant(name: string): Variant {
  const variant = VARIANTS[name];
  if (!variant) throw new Error(`Unknown variant "${name}". Known: ${Object.keys(VARIANTS).join(", ")}`);
  return variant;
}
