import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { routedSide } from "../../src/judging/blind.ts";
import { appendJudgment, JUDGMENTS_FILE, loadJudgments } from "../../src/judging/judgments.ts";
import { createJudgeServer } from "../../src/judging/server.ts";
import { manifestOf, pair } from "../support/level2-fixtures.ts";
import { listenForTests } from "../support/listen.ts";

const manifest = manifestOf([pair("a", "photo"), pair("same", "dflt")]);

const dir = await mkdtemp(join(tmpdir(), "typecast-judge-"));
const server = createJudgeServer(dir, manifest, () => new Date("2026-10-31T12:00:00Z"));
const { get, post } = listenForTests(server, {
  setup: async () => {
    await mkdir(join(dir, "images"));
    await writeFile(join(dir, "images", "a-photo.png"), "png-bytes");
  },
  cleanup: () => rm(dir, { recursive: true, force: true }),
});

describe("judge server", () => {
  it("serves the page and only pairs that differ, without revealing which side is routed", async () => {
    const page = await (await get("/")).text();
    expect(page).toContain("<title>Typecast Judge</title>");
    expect(page).toContain(`npm run judge-report -- ${dir}`);
    const state = await (await get("/api/next")).json();
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

  it("undoes only the human's last pick, even when an auto-judge wrote after it", async () => {
    const file = join(dir, JUDGMENTS_FILE);
    await post("/api/judge", { id: "a", pick: "tie" });
    await appendJudgment(file, { id: "a", winner: "routed", judge: "jev", at: "t" });

    const undone = await (await post("/api/undo", {})).json();
    expect(undone).toMatchObject({ judged: 0, pair: { id: "a" } });
    expect((await loadJudgments(file)).map((j) => `${j.id}:${j.judge}`)).toEqual(["a:jev"]);
    await rm(file);
  });

  it("rejects bodies that are not JSON objects", async () => {
    expect((await post("/api/judge", null)).status).toBe(400);
    expect((await post("/api/judge", [1])).status).toBe(400);
  });

  it("rejects unknown pairs and picks", async () => {
    expect((await post("/api/judge", { id: "nope", pick: "left" })).status).toBe(400);
    expect((await post("/api/judge", { id: "a", pick: "routed" })).status).toBe(400);
  });

  it("serves run images but nothing outside the images dir", async () => {
    expect(await (await get("/images/a-photo.png")).text()).toBe("png-bytes");
    expect((await get("/images/..%2Fmanifest.json")).status).toBe(404);
    expect((await get("/judgments.jsonl")).status).toBe(404);
  });
});
