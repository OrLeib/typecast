import { ROSTER } from "./roster.ts";

/** A routing configuration under test: the question instructions plus the roster descriptions. */
export type Variant = { instructions: string; roster: Record<string, string> };

export const VARIANTS: Record<string, Variant> = {
  baseline: {
    instructions: "Which image or video model category best fits this creative brief?",
    roster: ROSTER,
  },
};
