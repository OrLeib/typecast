// Local demo: route a brief live, show the pick-or-compare recommendation, render with the routed model(s),
// and show the eval evidence behind the confidence and the latest best-of-N shootout.
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { basename, join } from "node:path";
import { PICK_THRESHOLD } from "../routing/recommendation.ts";
import { HttpError, jsonErrors, readJsonObject, requestUrl, send, sendHtml, sendJson } from "../shared/http.ts";
import type { Evidence } from "./evidence.ts";
import { createJudgeApi, type JudgeApiConfig } from "./judge-api.ts";
import { DEMO_PAGE } from "./page.ts";
import { createRenderApi, type RenderApiConfig } from "./render-api.ts";
import { createRouteApi, type RouteApiConfig } from "./route-api.ts";
import { SHOOTOUT_IMAGE_PREFIX, type LoadedShootout } from "./shootout-evidence.ts";

type Example = { brief: string; expected: string; note?: string };

type DemoConfig = Omit<RouteApiConfig & JudgeApiConfig & RenderApiConfig, "cacheDir"> & {
  /** Model category -> description, as the router sees it. */
  roster: Record<string, string>;
  evidence: Evidence[];
  /** The latest judged shootout, if any: which model made the best image of each brief. */
  shootout?: LoadedShootout;
  /** Labelled briefs the page offers to try. Only tuned-against briefs: routing held-out ones here would leak their misses. */
  examples: Example[];
  /** Routes and judgments are kept here, so asking again costs no API call and gives the same answer. */
  cacheDir: string;
};

type JsonHandler = (body: Record<string, unknown>) => Promise<unknown>;

export function createDemoServer(config: DemoConfig): Server {
  const render = createRenderApi(config);
  const handlers: Record<string, JsonHandler> = {
    "GET /api/config": async () => ({
      roster: Object.entries(config.roster).map(([id, description]) => ({ id, description, generator: config.generators[id]?.name ?? null })),
      defaultGenerator: config.defaultGenerator.name,
      evidence: config.evidence,
      shootout: config.shootout?.evidence ?? null,
      examples: config.examples,
      pickThreshold: PICK_THRESHOLD,
    }),
    "POST /api/route": createRouteApi({ ...config, cacheDir: join(config.cacheDir, "routes") }),
    "POST /api/cached-image": render.cachedImage,
    "POST /api/judge": createJudgeApi({ ...config, cacheDir: join(config.cacheDir, "judgments") }),
  };

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = requestUrl(req);
    if (req.method === "GET" && url.pathname === "/") return sendHtml(res, DEMO_PAGE);
    if (req.method === "GET" && url.pathname.startsWith("/images/")) return sendImage(res, join(config.imagesDir, basename(url.pathname)));
    if (req.method === "GET" && url.pathname.startsWith(SHOOTOUT_IMAGE_PREFIX)) return sendImage(res, config.shootout?.files.get(url.pathname));
    if (req.method === "POST" && url.pathname === "/api/generate") return render.generate(await readJsonObject(req), res);
    const handler = handlers[`${req.method} ${url.pathname}`];
    if (!handler) throw new HttpError(404, "not found");
    const body = req.method === "POST" ? await readJsonObject(req) : {};
    return sendJson(res, await handler(body));
  }

  return createServer(jsonErrors(handle));
}

async function sendImage(res: ServerResponse, path: string | undefined) {
  if (!path) throw new HttpError(404, "not found");
  const bytes = await readFile(path).catch(() => {
    throw new HttpError(404, "not found");
  });
  send(res, 200, "image/png", bytes);
}
