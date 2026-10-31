import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROSTER } from "../src/roster.ts";

const rows = readFileSync(new URL("../data/briefs.jsonl", import.meta.url), "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as Record<string, unknown>);

describe("data/briefs.jsonl", () => {
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
