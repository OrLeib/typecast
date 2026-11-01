// Local demo: route a brief live, show the pick-or-compare recommendation, render with the routed model(s),
// and show the eval evidence behind the confidence.
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { basename, join } from "node:path";
import type { GenerationProgress, Generator } from "../generation/generator.ts";
import type { DecisionClient } from "../jev/client.ts";
import type { ImageAsset } from "../jev/parse.ts";
import { judgeWithJev } from "../judging/jev-judge.ts";
import { PICK_THRESHOLD, recommend } from "../routing/recommendation.ts";
import type { Router } from "../routing/router.ts";
import type { Evidence } from "./evidence.ts";
import { DEMO_PAGE } from "./page.ts";

export type DemoConfig = {
  router: Router;
  /** Model category -> description, as the router sees it. */
  roster: Record<string, string>;
  /** Category -> local generator. Categories without one (e.g. video) can be routed to but not rendered. */
  generators: Record<string, Generator>;
  /** The single model routing has to beat in Level 2, rendered on request to compare against the routed pick. */
  defaultGenerator: Generator;
  /** Judges a rendered routed-vs-default pair from the images. */
  judge: DecisionClient;
  evidence: Evidence[];
  examples: string[];
  /** USD per million input tokens, to show what a route costs. */
  inputPricePerMillion: number;
  imagesDir: string;
  seed: number;
};

/** Briefs longer than this are almost certainly pasted by mistake, and Jev bills per input token. */
const MAX_BRIEF_CHARS = 2000;
/** The only image URLs the demo hands out: a content hash in imagesDir. Anything else is refused before touching disk. */
const IMAGE_URL = /^\/images\/([0-9a-f]{16}\.png)$/;

export function createDemoServer(config: DemoConfig): Server {
  const renderOneAtATime = serialize();

  const handlers: Record<string, (body: Record<string, unknown>) => Promise<unknown>> = {
    "GET /api/config": async () => ({
      roster: Object.entries(config.roster).map(([id, description]) => ({ id, description, generator: config.generators[id]?.name ?? null })),
      defaultGenerator: config.defaultGenerator.name,
      evidence: config.evidence,
      examples: config.examples,
      pickThreshold: PICK_THRESHOLD,
    }),
    "POST /api/route": async (body) => {
      const brief = briefFrom(body);
      const route = await config.router.route(brief);
      return {
        choice: route.choice,
        confidence: route.confidence,
        probabilities: route.probabilities,
        model: route.model,
        latencyMs: route.latencyMs,
        costUsd: (route.inputTokens * config.inputPricePerMillion) / 1e6,
        recommendation: recommend(route),
      };
    },
    "POST /api/judge": async (body) => {
      const brief = briefFrom(body);
      const verdict = await judgeWithJev(config.judge, {
        brief,
        routed: await imageFrom(body.routed, "routed"),
        default: await imageFrom(body.default, "default"),
      });
      return {
        winner: verdict.winner,
        probabilities: verdict.probabilities,
        model: verdict.model,
        latencyMs: verdict.latencyMs,
        costUsd: (verdict.inputTokens * config.inputPricePerMillion) / 1e6,
      };
    },
  };

  /** Reads an image this demo rendered, named by the URL `/api/generate` returned for it. */
  async function imageFrom(url: unknown, field: string): Promise<ImageAsset> {
    const file = typeof url === "string" ? IMAGE_URL.exec(url)?.[1] : undefined;
    if (!file) throw new HttpError(400, `${field} must be an image URL from /api/generate`);
    const bytes = await readFile(join(config.imagesDir, file)).catch(() => {
      throw new HttpError(404, `${field} image not found; render it first`);
    });
    return { type: "image", format: "png", data_base64: bytes.toString("base64") };
  }

  /**
   * Streams the render as NDJSON events so the page can show progress: zero or more
   * `{ type: "progress", step, total }`, then `{ type: "done", image, generator, latencyMs, cached }` or `{ type: "error", error }`.
   * Bad requests fail before the stream starts, as plain JSON errors like every other route.
   * The body names a routed `category`, or sets `default: true` for the default model.
   */
  async function generate(body: Record<string, unknown>, res: ServerResponse) {
    const brief = briefFrom(body);
    const generator = generatorFrom(body);
    const file = `${createHash("sha256").update(`${generator.name}\n${config.seed}\n${brief}`).digest("hex").slice(0, 16)}.png`;
    const outputPath = join(config.imagesDir, file);
    const done = (latencyMs: number, cached: boolean) => ({ type: "done", image: `/images/${file}`, generator: generator.name, latencyMs, cached });

    res.writeHead(200, { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" });
    const emit = (event: Record<string, unknown>) => res.write(`${JSON.stringify(event)}\n`);
    try {
      // Same brief, model and seed always give the same image, so a repeat request is instant.
      if (await exists(outputPath)) {
        emit(done(0, true));
      } else {
        const onProgress = (progress: GenerationProgress) => emit({ type: "progress", ...progress });
        const { latencyMs } = await renderOneAtATime(() => generator.generate({ prompt: brief, seed: config.seed, outputPath }, onProgress));
        emit(done(latencyMs, false));
      }
    } catch (e) {
      emit({ type: "error", error: (e as Error).message });
    }
    res.end();
  }

  function generatorFrom(body: Record<string, unknown>): Generator {
    if (body.default === true) return config.defaultGenerator;
    const category = String(body.category ?? "");
    const generator = config.generators[category];
    if (!generator) throw new HttpError(400, `no local generator for "${category}"`);
    return generator;
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "GET" && url.pathname === "/") return send(res, 200, "text/html; charset=utf-8", DEMO_PAGE);
    if (req.method === "GET" && url.pathname.startsWith("/images/")) {
      const file = basename(url.pathname);
      const bytes = await readFile(join(config.imagesDir, file)).catch(() => {
        throw new HttpError(404, "not found");
      });
      return send(res, 200, "image/png", bytes);
    }
    if (req.method === "POST" && url.pathname === "/api/generate") return generate(parseJson(await readBody(req)), res);
    const handler = handlers[`${req.method} ${url.pathname}`];
    if (!handler) throw new HttpError(404, "not found");
    const body = req.method === "POST" ? parseJson(await readBody(req)) : {};
    return send(res, 200, "application/json", JSON.stringify(await handler(body)));
  }

  return createServer((req, res) => {
    handle(req, res).catch((e: unknown) => {
      const status = e instanceof HttpError ? e.status : 500;
      send(res, status, "application/json", JSON.stringify({ error: (e as Error).message }));
    });
  });
}

function briefFrom(body: Record<string, unknown>): string {
  const brief = typeof body.brief === "string" ? body.brief.trim() : "";
  if (!brief) throw new HttpError(400, "brief must be a non-empty string");
  if (brief.length > MAX_BRIEF_CHARS) throw new HttpError(400, `brief must be at most ${MAX_BRIEF_CHARS} characters`);
  return brief;
}

/** Image models fill most of unified memory, so renders run one at a time, in arrival order. */
function serialize() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(task, task);
    tail = result.catch(() => undefined);
    return result;
  };
}

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

function send(res: ServerResponse, status: number, type: string, body: string | Buffer) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function parseJson(text: string): Record<string, unknown> {
  try {
    const value = JSON.parse(text || "{}");
    if (typeof value === "object" && value !== null && !Array.isArray(value)) return value;
  } catch {
    // fall through to the error below
  }
  throw new HttpError(400, "body must be a JSON object");
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}
