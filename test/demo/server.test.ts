import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createDemoServer } from "../../src/demo/server.ts";
import { createJevJudge } from "../../src/judging/jev-judge.ts";
import { MAX_IMAGES, type Locator } from "../../src/locating/locator.ts";
import type { Router } from "../../src/routing/router.ts";
import { createFakeDecisionClient } from "../support/fake-decision-client.ts";
import { createFakeGenerator } from "../support/fake-generator.ts";
import { listenForTests } from "../support/listen.ts";

const dir = await mkdtemp(join(tmpdir(), "typecast-demo-"));
let routeCalls = 0;
const router: Router = {
  async route(brief) {
    routeCalls++;
    const unsure = brief.includes("maybe");
    return { choice: "photo", confidence: unsure ? 0.6 : 0.95, probabilities: unsure ? { photo: 0.6, video: 0.4 } : { photo: 0.95, video: 0.05 }, model: "jev-test", inputTokens: 500, latencyMs: 180 };
  },
};
const photo = createFakeGenerator("mflux:photo@q8", 4200, 2);
const fallback = createFakeGenerator("mflux:default@q8", 3000);
const judge = createFakeDecisionClient(() => ({ choice: "tie", confidence: 0.7 }));
let locateCalls = 0;
/** Finds the target in every image but the last of two or more, which it says is empty. */
const locator: Locator = {
  async locate(images) {
    locateCalls++;
    const found = images.map((_, i) => ({
      box: { top: 0.2, bottom: 0.4, left: 0.4, right: 0.6 },
      confidence: 0.9,
      presence: images.length > 1 && i === images.length - 1 ? 0.03 : 0.95,
    }));
    return { found, model: "jev-test", inputTokens: 3000 * images.length, latencyMs: 900 };
  },
};
const samplesDir = join(dir, "samples");
const localSamplesDir = join(dir, "local-samples");
/** 1000 x 800, so the fake box is 200 x 160 px centred at (500, 240). */
const samplePng = (background = "#808080") => sharp({ create: { width: 1000, height: 800, channels: 3, background } }).png().toBuffer();
const LOCATE = { locator, locatorId: "test-locator", samplesDirs: [samplesDir, localSamplesDir], bakedAnswerDirs: [] };
const CONFIG = {
  router,
  roster: { photo: "Photos", video: "Clips" },
  generators: { photo },
  defaultGenerator: fallback,
  judge: createJevJudge(judge),
  evidence: [],
  examples: [{ brief: "a brief", expected: "photo" }],
  inputPricePerMillion: 0.04,
  imagesDir: dir,
  cacheDir: join(dir, "cache"),
  routerId: "test-router",
  seed: 1,
  ...LOCATE,
};
const server = createDemoServer(CONFIG);
const { get, post } = listenForTests(server, {
  setup: async () => {
    await mkdir(samplesDir, { recursive: true });
    await mkdir(localSamplesDir, { recursive: true });
    await writeFile(join(samplesDir, "person.png"), await samplePng());
    await writeFile(join(samplesDir, "notes.txt"), "not an image");
    await writeFile(join(localSamplesDir, "local.png"), await samplePng("#406080"));
    await writeFile(join(localSamplesDir, "person.png"), "shadowed by the committed sample");
  },
  cleanup: () => rm(dir, { recursive: true, force: true }),
});
const events = async (res: Response) => (await res.text()).trim().split("\n").map((line) => JSON.parse(line));

describe("demo server", () => {
  it("describes the roster with each category's local generator", async () => {
    const config = await (await get("/api/config")).json();
    expect(config).toMatchObject({
      roster: [{ id: "photo", description: "Photos", generator: "mflux:photo@q8" }, { id: "video", description: "Clips", generator: null }],
      defaultGenerator: "mflux:default@q8",
      examples: [{ brief: "a brief", expected: "photo" }],
      pickThreshold: 0.85,
      shootout: null,
    });
  });

  it("routes a brief and recommends picking or comparing by confidence", async () => {
    const sure = await (await post("/api/route", { brief: "a beach at dawn" })).json();
    expect(sure).toMatchObject({ choice: "photo", confidence: 0.95, latencyMs: 180, model: "jev-test", cached: false, recommendation: { mode: "pick", shortlist: ["photo"] } });
    expect(sure.costUsd).toBeCloseTo(0.00002);

    const unsure = await (await post("/api/route", { brief: "maybe a clip" })).json();
    expect(unsure.recommendation).toEqual({ mode: "compare", shortlist: ["photo", "video"] });
  });

  it("answers a repeated brief from the cache without calling the router", async () => {
    const first = await (await post("/api/route", { brief: "a cached harbor" })).json();
    const calls = routeCalls;
    const again = await (await post("/api/route", { brief: "  a cached harbor  " })).json();
    expect(routeCalls).toBe(calls);
    expect(again).toEqual({ ...first, cached: true });
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

    expect(verdict).toMatchObject({ winner: "tie", model: "fake-1.0.0", latencyMs: 1, cached: false });
    expect(verdict.probabilities.tie).toBeCloseTo(0.7);
    expect(verdict.costUsd).toBeCloseTo(0.000004);
    const sent = Object.values(judge.assets.at(-1)!).map((a) => Buffer.from(a.data_base64, "base64").toString()).sort();
    expect(sent).toEqual(["default-png", "routed-png"]);

    const calls = judge.calls.length;
    const again = await (await post("/api/judge", { brief, routed, default: dflt })).json();
    expect(judge.calls).toHaveLength(calls);
    expect(again).toEqual({ ...verdict, cached: true });
  });

  it("refuses to judge images it didn't render", async () => {
    const outside = await post("/api/judge", { brief: "x", routed: "/images/../../.env", default: "/images/0123456789abcdef.png" });
    expect(outside.status).toBe(400);
    expect(await outside.json()).toEqual({ error: "routed must be an image URL from /api/generate" });
    const missing = await post("/api/judge", { brief: "x", routed: "/images/0123456789abcdef.png", default: "/images/fedcba9876543210.png" });
    expect(missing.status).toBe(404);
  });

  it("says whether an image is already rendered, without rendering it", async () => {
    const brief = "a quiet pier";
    const calls = photo.requests.length;
    expect(await (await post("/api/cached-image", { brief, category: "photo" })).json()).toEqual({ image: null, generator: "mflux:photo@q8" });
    expect(photo.requests).toHaveLength(calls);

    const rendered = (await events(await post("/api/generate", { brief, category: "photo" }))).at(-1);
    await writeFile(join(dir, rendered.image.slice("/images/".length)), "png");
    expect(await (await post("/api/cached-image", { brief, category: "photo" })).json()).toEqual({ image: rendered.image, generator: "mflux:photo@q8" });
    expect((await (await post("/api/cached-image", { brief, default: true })).json()).image).toBeNull();
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
    expect(await (await get("/")).text()).toContain("Which image model should make this?");
  });

  it("serves a page script that parses", async () => {
    const page = await (await get("/")).text();
    const script = /<script>([\s\S]*)<\/script>/.exec(page)?.[1] ?? "";
    expect(script).not.toBe("");
    // Compiles without running; catches escaping slips in the template literal that holds the page.
    expect(() => new Function(script)).not.toThrow();
  });
});

describe("demo server: find and crop", () => {
  const locateSamples = (samples: string[], padding: number) => post("/api/locate", { samples, target: "the person's face", padding });

  it("lists sample images from every samples folder, the first folder winning a shared name", async () => {
    expect(await (await get("/api/locate-samples")).json()).toEqual({
      samples: [
        { name: "person.png", url: "/locate-samples/person.png" },
        { name: "local.png", url: "/locate-samples/local.png" },
      ],
    });
  });

  it("serves a sample with its type, and nothing outside the samples folders", async () => {
    const res = await get("/locate-samples/person.png");
    expect(res.headers.get("content-type")).toBe("image/png");
    expect((await sharp(Buffer.from(await res.arrayBuffer())).metadata()).width).toBe(1000);
    expect((await get("/locate-samples/local.png")).status).toBe(200);
    expect((await get("/locate-samples/notes.txt")).status).toBe(404);
    expect((await get("/locate-samples/..%2Fcache")).status).toBe(404);
  });

  it("locates the target in one image and cuts a padded square around it, with what the request cost", async () => {
    const body = await (await locateSamples(["person.png"], 0.5)).json();
    expect(body).toMatchObject({ model: "jev-test", inputTokens: 3000, cached: false });
    expect(body.costUsd).toBeCloseTo(3000 * 0.04 / 1e6);
    const [image] = body.images;
    expect(image).toMatchObject({ name: "person.png", box: { top: 0.2, bottom: 0.4, left: 0.4, right: 0.6 }, confidence: 0.9, presence: 0.95 });
    expect(image.size).toEqual({ width: 1000, height: 800 });
    expect(image.crop).toEqual({ left: 300, top: 40, size: 400 });
    const preview = await sharp(Buffer.from(image.cropUrl.replace("data:image/webp;base64,", ""), "base64")).metadata();
    expect([preview.format, preview.width, preview.height]).toEqual(["webp", 400, 400]);
  });

  it("re-crops with new padding from the cached boxes, without locating again", async () => {
    const before = locateCalls;
    const body = await (await locateSamples(["person.png"], 0)).json();
    expect(locateCalls).toBe(before);
    expect(body.cached).toBe(true);
    expect(body.images[0].crop).toEqual({ left: 400, top: 140, size: 200 });
  });

  it("asks only about images it hasn't answered for that target, reusing the rest", async () => {
    let asked: number[] = [];
    const counting: Locator = { locate: async (images, target) => ((asked = [...asked, images.length]), locator.locate(images, target)) };
    const local = createDemoServer({ ...CONFIG, locator: counting, cacheDir: join(dir, "per-image-cache") });
    const { port } = await new Promise<{ port: number }>((resolve) => local.listen(0, "127.0.0.1", () => resolve(local.address() as { port: number })));
    const ask = async (samples: string[]) => (await fetch(`http://127.0.0.1:${port}/api/locate`, { method: "POST", body: JSON.stringify({ samples, target: "a face", padding: 0.5 }) })).json();
    try {
      const first = await ask(["person.png"]);
      const both = await ask(["person.png", "local.png"]);
      const again = await ask(["local.png", "person.png"]);
      expect(asked).toEqual([1, 1]);
      expect([first.cached, both.cached, again.cached]).toEqual([false, false, true]);
      expect(both.inputTokens).toBe(3000);
      expect(again.inputTokens).toBe(0);
      expect(again.images.map((i: { name: string }) => i.name)).toEqual(["local.png", "person.png"]);
    } finally {
      local.close();
    }
  });

  it("locates the target in samples and uploads together with one locator call, answering in the order sent", async () => {
    const before = locateCalls;
    const upload = "data:image/png;base64," + (await samplePng()).toString("base64");
    const res = await post("/api/locate", { samples: ["person.png", "local.png"], images: [upload], target: "a face", padding: 0.5 });
    const body = await res.json();
    expect(locateCalls).toBe(before + 1);
    expect(body.images.map((i: { name: string }) => i.name)).toEqual(["person.png", "local.png", "upload 1"]);
    expect(body.images.map((i: { presence: number }) => i.presence)).toEqual([0.95, 0.95, 0.03]);
    expect(body.inputTokens).toBe(9000);
  });

  it.each([
    ["an empty target", { samples: ["person.png"], target: " ", padding: 0.5 }, 400, /target must be a non-empty string/],
    ["padding out of range", { samples: ["person.png"], target: "a face", padding: 3 }, 400, /padding must be a number from 0 to 2/],
    ["an unknown sample", { samples: ["../.env"], target: "a face", padding: 0.5 }, 404, /no sample named \.env/],
    ["an image that isn't a data URL", { images: ["https://example.com/a.png"], target: "a face", padding: 0.5 }, 400, /images\[0\] must be a PNG or JPEG data URL/],
    ["no images", { target: "a face", padding: 0.5 }, 400, new RegExp(`send 1 to ${MAX_IMAGES} images, got 0`)],
    ["too many images", { samples: Array(MAX_IMAGES + 1).fill("person.png"), target: "a face", padding: 0.5 }, 400, new RegExp(`got ${MAX_IMAGES + 1}`)],
    ["samples that aren't a list", { samples: "person.png", target: "a face", padding: 0.5 }, 400, /samples must be a list of strings/],
  ])("rejects %s", async (_name, body, status, message) => {
    const res = await post("/api/locate", body);
    expect(res.status).toBe(status);
    expect((await res.json()).error).toMatch(message);
  });

  it("serves the find-and-crop page with a script that parses", async () => {
    const page = await (await get("/locate")).text();
    expect(page).toContain('aria-current="page">Find and crop');
    const script = /<script>([\s\S]*)<\/script>/.exec(page)?.[1] ?? "";
    expect(script).not.toBe("");
    expect(() => new Function(script)).not.toThrow();
  });
});

describe("demo server with a shootout", () => {
  const image = join(dir, "shot.png");
  const shootout = {
    evidence: { run: "r", data: "d", defaultGenerator: "g", picked: 0, models: 1, bestWas: { routed: 0, expected: 0, default: 0 }, meanAgreement: 0, briefs: [] },
    files: new Map([["/shootout-images/shot.png", image]]),
  };
  const withShootout = createDemoServer({
    router, roster: {}, generators: {}, defaultGenerator: fallback, judge: createJevJudge(judge), evidence: [], examples: [], shootout,
    inputPricePerMillion: 0.04, imagesDir: dir, cacheDir: join(dir, "cache"), routerId: "test-router", seed: 1, ...LOCATE,
  });
  const local = listenForTests(withShootout, { setup: () => writeFile(image, "shot-png") });

  it("sends the shootout evidence with the config", async () => {
    expect((await (await local.get("/api/config")).json()).shootout).toEqual(shootout.evidence);
  });

  it("serves the shootout's images and nothing else under its prefix", async () => {
    const res = await local.get("/shootout-images/shot.png");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("shot-png");
    expect((await local.get("/shootout-images/other.png")).status).toBe(404);
    expect((await local.get("/shootout-images/..%2Fcache")).status).toBe(404);
  });
});
