import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type RequestListener } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDiskCache } from "../../src/demo/disk-cache.ts";
import { locateCacheKey, locatorIdOf } from "../../src/demo/locate-api.ts";
import { createHostedApi } from "../../src/hosting/api.ts";
import type { UsageEntry } from "../../src/hosting/usage-log.ts";

const choice = JSON.parse(readFileSync(new URL("../fixtures/jev-choice-response.json", import.meta.url), "utf8"));
const box = JSON.parse(readFileSync(new URL("../fixtures/jev-box-response.json", import.meta.url), "utf8"));
const RECORDED: Record<string, unknown> = { choice: choice.answers.model, box: box.answers.face, noul: box.answers.present };
const JEV = { apiKey: "test-key", baseUrl: "http://jev.test", model: "jev-latest" };
const TARGET = "the person's face";

let jevCalls = 0;
/** Answers each question with the recorded live answer of its type, as Jev would. */
const fakeJev = (async (_url: string, init: RequestInit) => {
  jevCalls++;
  const { questions } = JSON.parse(init.body as string) as { questions: Record<string, { type: string }> };
  return new Response(JSON.stringify({ ...box, answers: Object.fromEntries(Object.entries(questions).map(([id, q]) => [id, RECORDED[q.type]])) }));
}) as unknown as typeof fetch;

const dir = await mkdtemp(join(tmpdir(), "typecast-hosted-"));
const samplesDir = join(dir, "samples");
const bakedAnswersDir = join(dir, "baked");
const png = (background: string) => sharp({ create: { width: 1000, height: 800, channels: 3, background } }).png().toBuffer();

let usage: UsageEntry[] = [];
const api = createHostedApi({ jev: JEV, samplesDir, bakedAnswersDir, cacheDir: join(dir, "tmp"), logUsage: (entry) => usage.push(entry) }, { fetch: fakeJev });
/** Vercel hands functions a request whose JSON body it already parsed into `req.body`. */
const asVercel = (handler: RequestListener, body: unknown): RequestListener => (req, res) => handler(Object.assign(req, { body }) as IncomingMessage, res);
const routes: Record<string, RequestListener> = {
  "/route": api.route,
  "/locate": api.locate,
  "/samples": api.samples,
  "/route-vercel": asVercel(api.route, { brief: "Hero shot of a perfume bottle on white" }),
};
const server = createServer((req, res) => routes[new URL(req.url ?? "/", "http://x").pathname](req, res));
let base = "";

beforeAll(async () => {
  await mkdir(samplesDir, { recursive: true });
  const baked = await png("#808080");
  await writeFile(join(samplesDir, "baked.png"), baked);
  await writeFile(join(samplesDir, "fresh.png"), await png("#406080"));
  const location = { box: box.answers.face.box, confidence: box.answers.face.confidence, presence: 0.97, model: "jev-1.14.0", inputTokens: 3706, latencyMs: 700 };
  await createDiskCache(bakedAnswersDir).set(locateCacheKey(locatorIdOf(JEV), baked, TARGET), location);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  server.close();
  await rm(dir, { recursive: true, force: true });
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) => fetch(base + path, { method: "POST", body: JSON.stringify(body), headers });
const reset = () => {
  jevCalls = 0;
  usage = [];
};
/** The headers Vercel adds to a request from a visitor in Tel Aviv. */
const VISITOR_HEADERS = {
  "x-forwarded-for": "203.0.113.57, 10.0.0.1",
  "x-vercel-ip-country": "IL",
  "x-vercel-ip-country-region": "TA",
  "x-vercel-ip-city": "Tel%20Aviv",
  "user-agent": "Mozilla/5.0 (Macintosh)",
  referer: "https://typecast-ai.vercel.app/demo",
};

describe("hosted API", () => {
  it("routes a brief live", async () => {
    reset();
    const res = await post("/route", { brief: "A spring sneaker campaign hero shot" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ choice: "product", recommendation: expect.anything() });
    expect(jevCalls).toBe(1);
  });

  it("reads a body the platform already parsed", async () => {
    reset();
    const res = await fetch(base + "/route-vercel", { method: "POST" });
    expect(res.status).toBe(200);
  });

  it("answers a baked-in sample without calling Jev", async () => {
    reset();
    const res = await post("/locate", { sample: "baked.png", target: TARGET, padding: 0.5 });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: "baked.png", presence: 0.97, cached: true, costUsd: 0 });
    expect(jevCalls).toBe(0);
  });

  it("locates an image it has no answer for live", async () => {
    reset();
    const res = await post("/locate", { sample: "fresh.png", target: TARGET, padding: 0.5 });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: "fresh.png", cached: false });
    expect(jevCalls).toBe(1);
  });

  it("lists the samples, and refuses anything but POST on the live endpoints", async () => {
    expect(await (await fetch(base + "/samples")).json()).toEqual({
      samples: [
        { name: "baked.png", url: "/locate-samples/baked.png" },
        { name: "fresh.png", url: "/locate-samples/fresh.png" },
      ],
    });
    expect((await fetch(base + "/route")).status).toBe(405);
  });

  it("logs who called a live endpoint and what it cost", async () => {
    reset();
    await post("/route", { brief: "A neon sign that reads OPEN, at night" }, VISITOR_HEADERS);
    expect(usage).toEqual([
      {
        endpoint: "route",
        status: 200,
        latencyMs: expect.any(Number),
        input: { brief: "A neon sign that reads OPEN, at night" },
        cached: false,
        model: "jev-1.14.0",
        billedInputTokens: expect.any(Number),
        costUsd: expect.any(Number),
        visitor: { ipPrefix: "203.0.113.0/24", country: "IL", region: "TA", city: "Tel Aviv", userAgent: "Mozilla/5.0 (Macintosh)", referer: "https://typecast-ai.vercel.app/demo" },
      },
    ]);
    expect(usage[0].billedInputTokens).toBeGreaterThan(0);
  });

  it("logs a cached answer as costing nothing, and never logs an uploaded image", async () => {
    reset();
    await post("/locate", { sample: "baked.png", target: TARGET, padding: 0.5 });
    await post("/locate", { image: "data:image/png;base64,AAAA", target: TARGET, padding: 0.5 });
    expect(usage.map(({ input, cached, billedInputTokens, costUsd }) => ({ input, cached, billedInputTokens, costUsd }))).toEqual([
      { input: { sample: "baked.png", target: TARGET }, cached: true, billedInputTokens: 0, costUsd: 0 },
      { input: { image: "upload", target: TARGET }, cached: undefined, billedInputTokens: 0, costUsd: 0 },
    ]);
  });

  it("logs a refused request with its status", async () => {
    reset();
    await post("/route", { brief: "" });
    expect(usage).toMatchObject([{ endpoint: "route", status: 400, error: "brief must be a non-empty string", billedInputTokens: 0, costUsd: 0 }]);
  });

  it("keeps only an IPv6 visitor's /48", async () => {
    reset();
    await post("/route", { brief: "A spring sneaker campaign hero shot" }, { "x-forwarded-for": "2001:db8:85a3:8d3:1319:8a2e:370:7348" });
    expect(usage[0].visitor.ipPrefix).toBe("2001:db8:85a3::/48");
  });
});
