// POST /api/route: route a brief and recommend picking or comparing, cached so asking again costs no API call.
import { recommend } from "../routing/recommendation.ts";
import type { Router } from "../routing/router.ts";
import { inputCostUsd } from "../shared/cost.ts";
import { cachedOrCompute, createDiskCache } from "./disk-cache.ts";
import { briefFrom } from "./requests.ts";

export type RouteApiConfig = {
  router: Router;
  /** Everything besides the brief that changes a route (variant, Jev model), so a changed router misses the cache. */
  routerId: string;
  inputPricePerMillion: number;
  cacheDir: string;
};

export function createRouteApi({ router, routerId, inputPricePerMillion, cacheDir }: RouteApiConfig) {
  const cache = createDiskCache<Record<string, unknown>>(cacheDir);
  return async (body: Record<string, unknown>) => {
    const brief = briefFrom(body);
    return cachedOrCompute(cache, `${routerId}\n${brief}`, async () => {
      const route = await router.route(brief);
      return {
        choice: route.choice,
        confidence: route.confidence,
        probabilities: route.probabilities,
        model: route.model,
        latencyMs: route.latencyMs,
        costUsd: inputCostUsd(route.inputTokens, inputPricePerMillion),
        recommendation: recommend(route),
      };
    });
  };
}
