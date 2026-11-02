// POST /api/route: route a brief and recommend picking or comparing, cached so asking again costs no API call.
import { recommend, type Recommendation } from "../routing/recommendation.ts";
import type { Route, Router } from "../routing/router.ts";
import type { Variant } from "../routing/variants.ts";
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

/** What makes a route: the variant's question and roster, and which Jev answers it. A change starts a fresh cache. */
export const routerIdOf = (variant: Variant, jev: { model: string; baseUrl: string }) => JSON.stringify({ variant, model: jev.model, baseUrl: jev.baseUrl });

export function createRouteApi({ router, routerId, inputPricePerMillion, cacheDir }: RouteApiConfig) {
  const cache = createDiskCache<Route & { recommendation: Recommendation }>(cacheDir);
  return async (body: Record<string, unknown>) => {
    const brief = briefFrom(body);
    const route = await cachedOrCompute(cache, `${routerId}\n${brief}`, async () => {
      const fresh = await router.route(brief);
      return { ...fresh, recommendation: recommend(fresh) };
    });
    return { ...route, costUsd: route.cached ? 0 : inputCostUsd(route.inputTokens, inputPricePerMillion) };
  };
}
