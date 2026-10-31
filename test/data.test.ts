import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROSTER } from "../src/routing/roster.ts";

const dataDir = new URL("../data/", import.meta.url);
const files = readdirSync(dataDir).filter((f) => f.endsWith(".jsonl"));
const load = (f: string) =>
  readFileSync(new URL(f, dataDir), "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Record<string, unknown>);

describe.each(files)("data/%s", (file) => {
  const rows = load(file);

  it("has only known fields with the right types", () => {
    for (const r of rows) {
      expect(Object.keys(r).every((k) => ["id", "brief", "expected", "note"].includes(k)), String(r.id)).toBe(true);
      expect(typeof r.id).toBe("string");
      expect(typeof r.brief === "string" && r.brief.trim().length > 0, String(r.id)).toBe(true);
      if ("note" in r) expect(typeof r.note === "string" && r.note.trim().length > 0, String(r.id)).toBe(true);
    }
  });

  it("labels every brief with a roster category", () => {
    for (const r of rows) expect(Object.keys(ROSTER), String(r.id)).toContain(r.expected);
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
        expect(seenIds.get(String(r.id)), `${f}: id ${r.id}`).toBeUndefined();
        expect(seenBriefs.get(norm(String(r.brief))), `${f}: brief ${r.id}`).toBeUndefined();
        seenIds.set(String(r.id), f);
        seenBriefs.set(norm(String(r.brief)), f);
      }
    }
  });
});
