// Why a route went where it did: a yes/no check per roster category on the requirement that decides it, in plain words.
import type { Recommendation } from "./recommendation.ts";
import type { Route } from "./router.ts";

/** A yes/no question whose yes is the reason to use a category, and how a UI words that yes. */
export type ReasonCheck = { label: string; question: string };

export type Reason = { category: string; label: string; probability: number };

/** What a UI can say about a route. */
export type Explanation = {
  /** A pick's reasons, the one that decided it first. Empty when the checks don't back the pick, rather than contradict it. */
  because: Reason[];
  /** An unsure route's two candidates' reasons: stating either in the brief would settle it. */
  open: Reason[];
};

/** TypeSafe's suggested line for treating a noul as yes. */
export const YES_AT = 0.7;

/** One check per category of the placeholder roster, in the order the labelling rules apply. */
export const REASON_CHECKS: Record<string, ReasonCheck> = {
  video: { label: "Output must move", question: "Must the final output itself move, as a clip, loop, animation or GIF?" },
  "fast-draft": { label: "Speed over quality", question: "Does the brief explicitly put speed, cost or volume ahead of quality?" },
  typography: { label: "Words must be readable", question: "Must specific words be readable in the final image?" },
  product: { label: "One product, clean backdrop", question: "Is a single product the hero of the image, on a studio or clean backdrop?" },
  photoreal: { label: "Real-world scene", question: "Should the image look like a photograph of real people, places or a real-world scene?" },
  illustration: { label: "Drawn or painted look", question: "Should the image look drawn, painted or otherwise stylized as artwork?" },
};

export function explain(route: Pick<Route, "choice" | "reasons">, recommendation: Recommendation): Explanation {
  const reasonFor = (category: string) => route.reasons.filter((r) => r.category === category);
  if (recommendation.mode === "compare") return { because: [], open: recommendation.shortlist.flatMap(reasonFor) };
  const [deciding] = reasonFor(route.choice);
  if (!deciding || deciding.probability < YES_AT) return { because: [], open: [] };
  return { because: [deciding, ...route.reasons.filter((r) => r !== deciding && r.probability >= YES_AT)], open: [] };
}
