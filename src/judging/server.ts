// Local blind-judging server: shows each pair with the routed image on a hidden, fixed side and records the pick.
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { join, normalize, sep } from "node:path";
import { IMAGES_DIR } from "../generation/runner.ts";
import type { Manifest } from "../generation/manifest.ts";
import { blindOrder, routedSide, type Side } from "./blind.ts";
import { appendJudgment, JUDGMENTS_FILE, latestByPair, loadJudgments, removeLastJudgment, type Winner } from "./judgments.ts";
import { judgePage } from "./page.ts";
import { needsJudging } from "./win-rate.ts";

export const HUMAN_JUDGE = "human";

type Pick = Side | "tie";
const PICKS: readonly Pick[] = ["left", "right", "tie"];

export function createJudgeServer(dir: string, manifest: Manifest, now: () => Date = () => new Date()): Server {
  const page = judgePage(dir);
  const file = join(dir, JUDGMENTS_FILE);
  const pairs = blindOrder(manifest.items.filter(needsJudging));
  const imageUrl = (image: string) => `/${image.split(sep).join("/")}`;

  async function next() {
    const judged = latestByPair(await loadJudgments(file), HUMAN_JUDGE);
    const pair = pairs.find((p) => !judged.has(p.id));
    const progress = { judged: pairs.filter((p) => judged.has(p.id)).length, total: pairs.length };
    if (!pair) return { ...progress, pair: null };
    const [left, right] = routedSide(pair.id) === "left" ? [pair.routed, pair.default] : [pair.default, pair.routed];
    return { ...progress, pair: { id: pair.id, brief: pair.brief, left: imageUrl(left.image), right: imageUrl(right.image) } };
  }

  async function judge(body: { id?: unknown; pick?: unknown }) {
    const pair = pairs.find((p) => p.id === body.id);
    if (!pair) throw new HttpError(400, `unknown pair id ${JSON.stringify(body.id)}`);
    if (!PICKS.includes(body.pick as Pick)) throw new HttpError(400, `pick must be one of ${PICKS.join(", ")}`);
    const pick = body.pick as Pick;
    const winner: Winner = pick === "tie" ? "tie" : pick === routedSide(pair.id) ? "routed" : "default";
    await appendJudgment(file, { id: pair.id, winner, judge: HUMAN_JUDGE, at: now().toISOString() });
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "GET" && url.pathname === "/") return send(res, 200, "text/html; charset=utf-8", page);
    if (req.method === "GET" && url.pathname === "/api/next") return sendJson(res, await next());
    if (req.method === "POST" && url.pathname === "/api/judge") {
      await judge(parseJson(await readBody(req)));
      return sendJson(res, await next());
    }
    if (req.method === "POST" && url.pathname === "/api/undo") {
      await removeLastJudgment(file);
      return sendJson(res, await next());
    }
    if (req.method === "GET" && url.pathname.startsWith(`/${IMAGES_DIR}/`)) return sendImage(res, dir, decodeURIComponent(url.pathname.slice(1)));
    throw new HttpError(404, "not found");
  }

  return createServer((req, res) => {
    handle(req, res).catch((e: unknown) => {
      const status = e instanceof HttpError ? e.status : 500;
      sendJson(res, { error: (e as Error).message }, status);
    });
  });
}

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Serves only files inside the run's images directory. */
async function sendImage(res: ServerResponse, dir: string, relative: string) {
  const path = normalize(relative);
  if (!path.startsWith(IMAGES_DIR + sep) || path.includes("..")) throw new HttpError(404, "not found");
  const bytes = await readFile(join(dir, path)).catch(() => {
    throw new HttpError(404, `no image ${path}`);
  });
  send(res, 200, "image/png", bytes);
}

function send(res: ServerResponse, status: number, type: string, body: string | Buffer) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

const sendJson = (res: ServerResponse, body: unknown, status = 200) => send(res, status, "application/json", JSON.stringify(body));

function parseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "body must be JSON");
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}
