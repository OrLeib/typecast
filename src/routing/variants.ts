import { ROSTER } from "./roster.ts";

/** A routing configuration under test: the question instructions plus the roster descriptions. */
export type Variant = { instructions: string; roster: Record<string, string> };

export const VARIANTS: Record<string, Variant> = {
  baseline: {
    instructions: "Which image or video model category best fits this creative brief?",
    roster: ROSTER,
  },
};

export function getVariant(name: string): Variant {
  const variant = VARIANTS[name];
  if (!variant) throw new Error(`Unknown variant "${name}". Known: ${Object.keys(VARIANTS).join(", ")}`);
  return variant;
}
