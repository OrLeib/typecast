// Plumbing shared by the local servers (judging page, demo). Nothing here knows what the servers serve.
import type { IncomingMessage, RequestListener, ServerResponse } from "node:http";

/** An error that becomes an HTTP answer with this status; anything else is a 500. */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Every answer is uncacheable: the servers are local and their state changes with each click. */
export function send(res: ServerResponse, status: number, type: string, body: string | Buffer): void {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

export const sendHtml = (res: ServerResponse, html: string) => send(res, 200, "text/html; charset=utf-8", html);

export const sendJson = (res: ServerResponse, body: unknown, status = 200) => send(res, status, "application/json", JSON.stringify(body));

/** Runs an async handler, answering a thrown error as `{ error }` JSON with its status. */
export function jsonErrors(handle: (req: IncomingMessage, res: ServerResponse) => Promise<unknown>): RequestListener {
  return (req, res) => {
    handle(req, res).catch((e: unknown) => sendJson(res, { error: (e as Error).message }, e instanceof HttpError ? e.status : 500));
  };
}

/** The request's path and query; the host is irrelevant to a local server. */
export const requestUrl = (req: IncomingMessage) => new URL(req.url ?? "/", "http://localhost");

/** Reads the request body as a JSON object. An empty body is `{}`; anything but an object is a 400. */
export async function readJsonObject(req: IncomingMessage): Promise<Record<string, unknown>> {
  const text = await readBody(req);
  try {
    const value: unknown = JSON.parse(text || "{}");
    if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
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
