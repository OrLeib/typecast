import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Manifest } from "../../src/generation/manifest.ts";
import type { GenerationItem } from "../../src/generation/runner.ts";
import { routedSide } from "../../src/judging/blind.ts";
import { JUDGMENTS_FILE, loadJudgments } from "../../src/judging/judgments.ts";
import { createJudgeServer } from "../../src/judging/server.ts";

const pair = (id: string, routed: string): GenerationItem => ({
  id, brief: `brief ${id}`, expected: "photo",
  route: { choice: "photo", confidence: 0.9, model: "jev" },
  routed: { generator: routed, image: `images/${id}-${routed}.png`, latencyMs: 1 },
  default: { generator: "dflt", image: `images/${id}-dflt.png`, latencyMs: 1 },
});

const manifest: Manifest = {
  meta: { data: "d", variant: "v", seed: 1, perCategory: 1, defaultGenerator: "dflt", lineup: {}, commit: "c", createdAt: "t" },
  items: [pair("a", "photo"), pair("same", "dflt")],
};

const dir = await mkdtemp(join(tmpdir(), "typecast-judge-"));
const server = createJudgeServer(dir, manifest, () => new Date("2026-10-31T12:00:00Z"));
let base = "";

beforeAll(async () => {
  await mkdir(join(dir, "images"));
  await writeFile(join(dir, "images", "a-photo.png"), "png-bytes");
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.close();
  await rm(dir, { recursive: true, force: true });
});

const post = (path: string, body: unknown) => fetch(base + path, { method: "POST", body: JSON.stringify(body) });

describe("judge server", () => {
  it("serves the page and only pairs that differ, without revealing which side is routed", async () => {
    const page = await (await fetch(base + "/")).text();
    expect(page).toContain("<title>Typecast Judge</title>");
    expect(page).toContain(`npm run judge-report -- ${dir}`);
    const state = await (await fetch(base + "/api/next")).json();
    expect(state).toMatchObject({ judged: 0, total: 1, pair: { id: "a", brief: "brief a" } });
    expect(JSON.stringify(state)).not.toMatch(/routed|default/);
    const routedUrl = "/images/a-photo.png";
    expect(state.pair[routedSide("a")]).toBe(routedUrl);
  });

  it("records a pick of the routed side as a routed win, and undoes it", async () => {
    const after = await (await post("/api/judge", { id: "a", pick: routedSide("a") })).json();
    expect(after).toEqual({ judged: 1, total: 1, pair: null });
    expect(await loadJudgments(join(dir, JUDGMENTS_FILE))).toEqual([{ id: "a", winner: "routed", judge: "human", at: "2026-10-31T12:00:00.000Z" }]);

    const undone = await (await post("/api/undo", {})).json();
    expect(undone).toMatchObject({ judged: 0, pair: { id: "a" } });
  });

  it("rejects unknown pairs and picks", async () => {
    expect((await post("/api/judge", { id: "nope", pick: "left" })).status).toBe(400);
    expect((await post("/api/judge", { id: "a", pick: "routed" })).status).toBe(400);
  });

  it("serves run images but nothing outside the images dir", async () => {
    expect(await (await fetch(base + "/images/a-photo.png")).text()).toBe("png-bytes");
    expect((await fetch(base + "/images/..%2Fmanifest.json")).status).toBe(404);
    expect((await fetch(base + "/judgments.jsonl")).status).toBe(404);
  });
});
