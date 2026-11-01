import type { Route } from "./router.ts";

/**
 * At or above this confidence a UI can just pick. It is the line evaluation calls a "confident miss",
 * so the number of wrong picks this would make is exactly what eval reports as confident misses.
 */
export const PICK_THRESHOLD = 0.85;

/** What a UI should do with a route: use one model, or put the top two side by side. */
export type Recommendation = { mode: "pick"; shortlist: [string] } | { mode: "compare"; shortlist: [string, string] };

export function recommend(route: Pick<Route, "choice" | "confidence" | "probabilities">, threshold = PICK_THRESHOLD): Recommendation {
  if (route.confidence >= threshold) return { mode: "pick", shortlist: [route.choice] };
  const [runnerUp] = Object.entries(route.probabilities).filter(([option]) => option !== route.choice).sort(([, a], [, b]) => b - a);
  if (!runnerUp) return { mode: "pick", shortlist: [route.choice] };
  return { mode: "compare", shortlist: [route.choice, runnerUp[0]] };
}
