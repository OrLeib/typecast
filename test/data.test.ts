import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBriefs } from "../src/evaluation/briefs.ts";
import { ROSTER } from "../src/routing/roster.ts";

const dataDir = new URL("../data/", import.meta.url);
const files = readdirSync(dataDir).filter((f) => f.endsWith(".jsonl"));
// parseBriefs rejects unknown fields and empty or non-string values, naming the line.
const load = (f: string) => parseBriefs(readFileSync(new URL(f, dataDir), "utf8"), f);

describe.each(files)("data/%s", (file) => {
  const rows = load(file);

  it("labels every brief with a roster category", () => {
    for (const r of rows) expect(Object.keys(ROSTER), r.id).toContain(r.expected);
  });

  it("has unique ids", () => {
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });
});

describe("splits", () => {
  it("share no ids or brief texts, so held-out results are not contaminated", () => {
    const seenIds = new Map<string, string>();
    const seenBriefs = new Map<string, string>();
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    for (const f of files) {
      for (const r of load(f)) {
        expect(seenIds.get(r.id), `${f}: id ${r.id}`).toBeUndefined();
        expect(seenBriefs.get(norm(r.brief)), `${f}: brief ${r.id}`).toBeUndefined();
        seenIds.set(r.id, f);
        seenBriefs.set(norm(r.brief), f);
      }
    }
  });
});
