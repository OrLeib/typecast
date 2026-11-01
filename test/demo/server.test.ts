import { mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDemoServer } from "../../src/demo/server.ts";
import type { Router } from "../../src/routing/router.ts";
import { createFakeDecisionClient } from "../support/fake-decision-client.ts";
import { createFakeGenerator } from "../support/fake-generator.ts";

const dir = await mkdtemp(join(tmpdir(), "typecast-demo-"));
const router: Router = {
  async route(brief) {
    const unsure = brief.includes("maybe");
    return { type: "choice", choice: "photo", confidence: unsure ? 0.6 : 0.95, probabilities: unsure ? { photo: 0.6, video: 0.4 } : { photo: 0.95, video: 0.05 }, model: "jev-test", inputTokens: 500, latencyMs: 180 };
  },
};
const photo = createFakeGenerator("mflux:photo@q8", 4200, 2);
const fallback = createFakeGenerator("mflux:default@q8", 3000);
const judge = createFakeDecisionClient(() => ({ choice: "tie", confidence: 0.7 }));
const server = createDemoServer({
  router,
  roster: { photo: "Photos", video: "Clips" },
  generators: { photo },
  defaultGenerator: fallback,
  judge,
  evidence: [],
  examples: ["a brief"],
  inputPricePerMillion: 0.04,
  imagesDir: dir,
  seed: 1,
});
let base = "";

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.close();
  await rm(dir, { recursive: true, force: true });
});

const post = (path: string, body: unknown) => fetch(base + path, { method: "POST", body: JSON.stringify(body) });
const events = async (res: Response) => (await res.text()).trim().split("\n").map((line) => JSON.parse(line));

describe("demo server", () => {
  it("describes the roster with each category's local generator", async () => {
    const config = await (await fetch(base + "/api/config")).json();
    expect(config).toMatchObject({
      roster: [{ id: "photo", description: "Photos", generator: "mflux:photo@q8" }, { id: "video", description: "Clips", generator: null }],
      defaultGenerator: "mflux:default@q8",
      examples: ["a brief"],
      pickThreshold: 0.85,
    });
  });

  it("routes a brief and recommends picking or comparing by confidence", async () => {
    const sure = await (await post("/api/route", { brief: "a beach at dawn" })).json();
    expect(sure).toMatchObject({ choice: "photo", confidence: 0.95, latencyMs: 180, model: "jev-test", recommendation: { mode: "pick", shortlist: ["photo"] } });
    expect(sure.costUsd).toBeCloseTo(0.00002);

    const unsure = await (await post("/api/route", { brief: "maybe a clip" })).json();
    expect(unsure.recommendation).toEqual({ mode: "compare", shortlist: ["photo", "video"] });
  });

  it("rejects an empty brief", async () => {
    const res = await post("/api/route", { brief: "  " });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "brief must be a non-empty string" });
  });

  it("streams a render's progress, then the image from the category's generator", async () => {
    const res = await post("/api/generate", { brief: "a beach at dawn", category: "photo" });
    expect(res.headers.get("content-type")).toBe("application/x-ndjson");
    const [first, second, done] = await events(res);
    expect([first, second]).toEqual([{ type: "progress", step: 1, total: 2 }, { type: "progress", step: 2, total: 2 }]);
    expect(done).toMatchObject({ type: "done", generator: "mflux:photo@q8", latencyMs: 4200, cached: false });
    expect(done.image).toMatch(/^\/images\/[0-9a-f]{16}\.png$/);
    expect(photo.requests[0]).toMatchObject({ prompt: "a beach at dawn", seed: 1, outputPath: join(dir, done.image.slice("/images/".length)) });
  });

  it("serves a rendered image again from disk, without progress", async () => {
    const brief = "a cached beach";
    const rendered = (await events(await post("/api/generate", { brief, category: "photo" }))).at(-1);
    await writeFile(join(dir, rendered.image.slice("/images/".length)), "png");
    expect(await events(await post("/api/generate", { brief, category: "photo" }))).toEqual([{ ...rendered, latencyMs: 0, cached: true }]);
  });

  it("renders the same brief with the default model on request, to a separate image", async () => {
    const routed = (await events(await post("/api/generate", { brief: "a harbor at dusk", category: "photo" }))).at(-1);
    const done = (await events(await post("/api/generate", { brief: "a harbor at dusk", default: true }))).at(-1);
    expect(done).toMatchObject({ type: "done", generator: "mflux:default@q8", latencyMs: 3000, cached: false });
    expect(done.image).not.toBe(routed.image);
    expect(fallback.requests.at(-1)).toMatchObject({ prompt: "a harbor at dusk", seed: 1 });
  });

  it("judges a rendered routed-vs-default pair from the images, with Jev's probabilities and cost", async () => {
    const brief = "a lighthouse in fog";
    const routed = (await events(await post("/api/generate", { brief, category: "photo" }))).at(-1).image;
    const dflt = (await events(await post("/api/generate", { brief, default: true }))).at(-1).image;
    await writeFile(join(dir, routed.slice("/images/".length)), "routed-png");
    await writeFile(join(dir, dflt.slice("/images/".length)), "default-png");

    const verdict = await (await post("/api/judge", { brief, routed, default: dflt })).json();

    expect(verdict).toMatchObject({ winner: "tie", model: "fake-1.0.0", latencyMs: 1 });
    expect(verdict.probabilities.tie).toBeCloseTo(0.7);
    expect(verdict.costUsd).toBeCloseTo(0.000004);
    const sent = Object.values(judge.assets.at(-1)!).map((a) => Buffer.from(a.data_base64, "base64").toString()).sort();
    expect(sent).toEqual(["default-png", "routed-png"]);
  });

  it("refuses to judge images it didn't render", async () => {
    const outside = await post("/api/judge", { brief: "x", routed: "/images/../../.env", default: "/images/0123456789abcdef.png" });
    expect(outside.status).toBe(400);
    expect(await outside.json()).toEqual({ error: "routed must be an image URL from /api/generate" });
    const missing = await post("/api/judge", { brief: "x", routed: "/images/0123456789abcdef.png", default: "/images/fedcba9876543210.png" });
    expect(missing.status).toBe(404);
  });

  it("refuses categories without a generator before streaming", async () => {
    const res = await post("/api/generate", { brief: "x", category: "video" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'no local generator for "video"' });
  });

  it("ends the stream with an error event when the render fails", async () => {
    photo.generate = async () => {
      throw new Error("out of memory");
    };
    expect(await events(await post("/api/generate", { brief: "a failing beach", category: "photo" }))).toEqual([{ type: "error", error: "out of memory" }]);
  });

  it("serves the page", async () => {
    expect(await (await fetch(base + "/")).text()).toContain("Which image model should make this?");
  });

  it("serves a page script that parses", async () => {
    const page = await (await fetch(base + "/")).text();
    const script = /<script>([\s\S]*)<\/script>/.exec(page)?.[1] ?? "";
    expect(script).not.toBe("");
    // Compiles without running; catches escaping slips in the template literal that holds the page.
    expect(() => new Function(script)).not.toThrow();
  });
});
