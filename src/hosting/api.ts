// The hosted demo's API as serverless request handlers: the same route and locate handlers the local demo uses, with
// the caches on the only writable disk a function has.
import type { IncomingMessage, RequestListener } from "node:http";
import { performance } from "node:perf_hooks";
import { join } from "node:path";
import { createLocateApi, locatorIdOf } from "../demo/locate-api.ts";
import { createRouteApi, routerIdOf } from "../demo/route-api.ts";
import { createJevClient, JEV_INPUT_PRICE_PER_MILLION, type JevClientDeps, type JevConfig } from "../jev/client.ts";
import { withRetries } from "../jev/retry.ts";
import { createJevLocator, JEV_LOCATE_RETRIES } from "../locating/locator.ts";
import { createDecisionRouter } from "../routing/router.ts";
import { DEFAULT_VARIANT, getVariant } from "../routing/variants.ts";
import { HttpError, jsonErrors, readJsonObject, sendJson } from "../shared/http.ts";
import { type Billed, billingOf, inputOf, type UsageLog, visitorOf } from "./usage-log.ts";

export type HostedConfig = {
  jev: JevConfig;
  samplesDir: string;
  /** Answers for the samples, baked in when the site is built. */
  bakedAnswersDir: string;
  /** Somewhere writable; on a serverless function that is only the temp folder, and it lasts as long as the instance. */
  cacheDir: string;
  /** Where each call to a live endpoint is recorded. */
  logUsage: UsageLog;
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
  const post = livePost(config.logUsage);
  return { route: post("route", route), locate: post("locate", locate.locate), samples: jsonErrors(async (_req, res) => sendJson(res, await locate.samples())) };
}

/** A POST-only JSON handler that logs every call it answers, refused or not. */
const livePost = (logUsage: UsageLog) => (endpoint: string, handle: (body: Record<string, unknown>) => Promise<Billed>): RequestListener =>
  jsonErrors(async (req, res) => {
    if (req.method !== "POST") throw new HttpError(405, "use POST");
    const started = performance.now();
    const body = await bodyOf(req);
    const entry = (status: number) => ({ endpoint, status, latencyMs: Math.round(performance.now() - started), input: inputOf(body), visitor: visitorOf(req) });
    try {
      const result = await handle(body);
      logUsage({ ...entry(200), ...billingOf(result) });
      sendJson(res, result);
    } catch (e) {
      logUsage({ ...entry(e instanceof HttpError ? e.status : 500), error: (e as Error).message, billedInputTokens: 0, costUsd: 0 });
      throw e;
    }
  });

/** Vercel's Node runtime parses JSON bodies itself and leaves the stream empty; a plain Node server leaves it to us. */
async function bodyOf(req: IncomingMessage): Promise<Record<string, unknown>> {
  const parsed = (req as IncomingMessage & { body?: unknown }).body;
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  return readJsonObject(req);
}
