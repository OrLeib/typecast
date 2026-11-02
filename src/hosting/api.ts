// The hosted demo's API as serverless request handlers: the same route and locate handlers the local demo uses, with
// the caches on the only writable disk a function has.
import type { IncomingMessage, RequestListener } from "node:http";
import { join } from "node:path";
import { createLocateApi, locatorIdOf } from "../demo/locate-api.ts";
import { createRouteApi, routerIdOf } from "../demo/route-api.ts";
import { createJevClient, JEV_INPUT_PRICE_PER_MILLION, type JevClientDeps, type JevConfig } from "../jev/client.ts";
import { withRetries } from "../jev/retry.ts";
import { createJevLocator, JEV_LOCATE_RETRIES } from "../locating/locator.ts";
import { createDecisionRouter } from "../routing/router.ts";
import { DEFAULT_VARIANT, getVariant } from "../routing/variants.ts";
import { HttpError, jsonErrors, readJsonObject, sendJson } from "../shared/http.ts";

export type HostedConfig = {
  jev: JevConfig;
  samplesDir: string;
  /** Answers for the samples, baked in when the site is built. */
  bakedAnswersDir: string;
  /** Somewhere writable; on a serverless function that is only the temp folder, and it lasts as long as the instance. */
  cacheDir: string;
};

export function createHostedApi(config: HostedConfig, deps: JevClientDeps = {}): Record<"route" | "locate" | "samples", RequestListener> {
  const jev = createJevClient(config.jev, deps);
  const variant = getVariant(DEFAULT_VARIANT);
  const route = createRouteApi({
    router: createDecisionRouter(jev, variant),
    routerId: routerIdOf(variant, config.jev),
    inputPricePerMillion: JEV_INPUT_PRICE_PER_MILLION,
    cacheDir: join(config.cacheDir, "routes"),
  });
  const locate = createLocateApi({
    locator: createJevLocator(withRetries(jev, JEV_LOCATE_RETRIES)),
    locatorId: locatorIdOf(config.jev),
    inputPricePerMillion: JEV_INPUT_PRICE_PER_MILLION,
    samplesDirs: [config.samplesDir],
    cacheDir: join(config.cacheDir, "locations"),
    bakedAnswersDir: config.bakedAnswersDir,
  });
  return { route: post(route), locate: post(locate.locate), samples: jsonErrors(async (_req, res) => sendJson(res, await locate.samples())) };
}

/** A POST-only JSON handler. */
function post(handle: (body: Record<string, unknown>) => Promise<unknown>): RequestListener {
  return jsonErrors(async (req, res) => {
    if (req.method !== "POST") throw new HttpError(405, "use POST");
    sendJson(res, await handle(await bodyOf(req)));
  });
}

/** Vercel's Node runtime parses JSON bodies itself and leaves the stream empty; a plain Node server leaves it to us. */
async function bodyOf(req: IncomingMessage): Promise<Record<string, unknown>> {
  const parsed = (req as IncomingMessage & { body?: unknown }).body;
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  return readJsonObject(req);
}
