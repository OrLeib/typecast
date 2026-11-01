import type { Judgment } from "./judgments.ts";

/**
 * How often two judges called the same winner, over the pairs both judged. `opposite` counts the worst disagreements:
 * one picked the routed image and the other the default. An auto-judge can stand in for hand judging only if it agrees
 * about as often as a person would with themselves.
 */
export type Agreement = { n: number; agree: number; opposite: number; rate: number };

export function agreement(a: Map<string, Judgment>, b: Map<string, Judgment>): Agreement {
  const shared = [...a].flatMap(([id, x]) => (b.has(id) ? [[x.winner, b.get(id)!.winner]] : []));
  const agree = shared.filter(([x, y]) => x === y).length;
  const opposite = shared.filter(([x, y]) => x !== y && x !== "tie" && y !== "tie").length;
  return { n: shared.length, agree, opposite, rate: shared.length ? agree / shared.length : NaN };
}
