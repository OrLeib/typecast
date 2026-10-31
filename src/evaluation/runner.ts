import type { Router } from "../routing/router.ts";
import type { Brief } from "./briefs.ts";
import type { Result } from "./result.ts";

/** Routes every brief `repeats` times, in order, reporting each result as it lands. */
export async function runEval(
  router: Router,
  briefs: Brief[],
  repeats: number,
  onResult: (result: Result) => void = () => {},
): Promise<Result[]> {
  const results: Result[] = [];
  for (let repeat = 0; repeat < repeats; repeat++) {
    for (const brief of briefs) {
      const route = await router.route(brief.brief);
      const result: Result = {
        id: brief.id,
        repeat,
        expected: brief.expected,
        choice: route.choice,
        confidence: route.confidence,
        probabilities: route.probabilities,
        latencyMs: route.latencyMs,
        inputTokens: route.inputTokens,
        model: route.model,
      };
      results.push(result);
      onResult(result);
    }
  }
  return results;
}
