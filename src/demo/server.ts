// Local demo: the home page's three decisions, a page that routes a brief live, shows the pick-or-compare recommendation,
// renders with the routed model(s) and shows the eval evidence, and a which-image page with the latest best-of-N shootout.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { basename, extname, join } from "node:path";
import { PICK_THRESHOLD } from "../routing/recommendation.ts";
import { decodePath, HttpError, jsonErrors, readJsonObject, requestUrl, sendFile, sendHtml, sendJson } from "../shared/http.ts";
import type { Evidence } from "./evidence.ts";
import type { HomeStory } from "./home-stories.ts";
import { homePage } from "./home.ts";
import { createJudgeApi, type JudgeApiConfig } from "./judge-api.ts";
import { createLocateApi, findSamples, SAMPLE_IMAGE_PREFIX, SAMPLE_TYPES, type LocateApiConfig } from "./locate-api.ts";
import { locatePage } from "./locate-page.ts";
import { PAGE_PATHS } from "./page-style.ts";
import { demoPage } from "./page.ts";
import { createRenderApi, type RenderApiConfig } from "./render-api.ts";
import { createRouteApi, type RouteApiConfig } from "./route-api.ts";
import { SHOOTOUT_IMAGE_PREFIX, type LoadedShootout } from "./shootout-evidence.ts";
import { showcasePage } from "./showcase.ts";

type Example = { brief: string; expected: string; note?: string };

type DemoConfig = Omit<RouteApiConfig & JudgeApiConfig & RenderApiConfig & LocateApiConfig, "cacheDir"> & {
  /** Model category -> description, as the router sees it. */
  roster: Record<string, string>;
  evidence: Evidence[];
  /** The latest judged shootout, if any: which model made the best image of each brief. */
  shootout?: LoadedShootout;
  /** The briefs the home page walks through. */
  stories: HomeStory[];
  /** Labelled briefs the page offers to try. Only tuned-against briefs: routing held-out ones here would leak their misses. */
  examples: Example[];
  /** Routes and judgments are kept here, so asking again costs no API call and gives the same answer. */
  cacheDir: string;
};

type JsonHandler = (body: Record<string, unknown>) => Promise<unknown>;

/** What the routing page reads at start: the roster, evidence and examples. The hosted site bakes it into a static file. */
export const demoConfigOf = (config: Pick<DemoConfig, "roster" | "generators" | "defaultGenerator" | "evidence" | "examples">) => ({
  roster: Object.entries(config.roster).map(([id, description]) => ({ id, description, generator: config.generators[id]?.name ?? null })),
  defaultGenerator: config.defaultGenerator.name,
  evidence: config.evidence,
  examples: config.examples,
  pickThreshold: PICK_THRESHOLD,
});

export function createDemoServer(config: DemoConfig): Server {
  const pages: Record<string, string> = {
    [PAGE_PATHS.home]: homePage({ stories: config.stories, defaultGenerator: config.defaultGenerator.name }),
    [PAGE_PATHS.results]: showcasePage({ shootout: config.shootout?.evidence }),
    [PAGE_PATHS.route]: demoPage({ hosted: false }),
    [PAGE_PATHS.locate]: locatePage({ hosted: false }),
  };
  const render = createRenderApi(config);
  const locate = createLocateApi({ ...config, cacheDir: join(config.cacheDir, "locations") });
  const handlers: Record<string, JsonHandler> = {
    "GET /api/config": async () => demoConfigOf(config),
    "POST /api/route": createRouteApi({ ...config, cacheDir: join(config.cacheDir, "routes") }),
    "POST /api/cached-image": render.cachedImage,
    "POST /api/judge": createJudgeApi({ ...config, cacheDir: join(config.cacheDir, "judgments") }),
    "GET /api/locate-samples": locate.samples,
    "POST /api/locate": locate.locate,
  };

  /** Each kind of image URL, and the file and type it is read from. `basename` keeps a request inside its folder. */
  const imageSources: { prefix: string; resolve: (pathname: string) => ImageFile | Promise<ImageFile> }[] = [
    { prefix: "/images/", resolve: (pathname) => ({ path: join(config.imagesDir, basename(pathname)), type: "image/png" }) },
    { prefix: SHOOTOUT_IMAGE_PREFIX, resolve: (pathname) => ({ path: config.shootout?.files.get(pathname), type: "image/png" }) },
    {
      prefix: SAMPLE_IMAGE_PREFIX,
      resolve: async (pathname) => {
        const name = basename(decodePath(pathname));
        return { path: (await findSamples(config.samplesDirs)).get(name), type: SAMPLE_TYPES[extname(name).toLowerCase()] };
      },
    },
  ];

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = requestUrl(req);
    if (req.method === "GET" && url.pathname in pages) return sendHtml(res, pages[url.pathname]);
    const images = req.method === "GET" ? imageSources.find(({ prefix }) => url.pathname.startsWith(prefix)) : undefined;
    if (images) {
      const { path, type } = await images.resolve(url.pathname);
      if (!path || !type) throw new HttpError(404, "not found");
      return sendFile(res, path, type);
    }
    if (req.method === "POST" && url.pathname === "/api/generate") return render.generate(await readJsonObject(req), res);
    const handler = handlers[`${req.method} ${url.pathname}`];
    if (!handler) throw new HttpError(404, "not found");
    const body = req.method === "POST" ? await readJsonObject(req) : {};
    return sendJson(res, await handler(body));
  }

  return createServer(jsonErrors(handle));
}

/** An image a URL names: unset when the URL names none the demo serves. */
type ImageFile = { path?: string; type?: string };
