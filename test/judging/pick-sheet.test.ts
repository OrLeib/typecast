import { describe, expect, it } from "vitest";
import { renderPickSheet } from "../../src/judging/pick-sheet.ts";
import { shootoutOf } from "../support/level2-fixtures.ts";

const manifest = shootoutOf([{ id: "a", choice: "photo" }, { id: "b", choice: "photo" }]);
const picks = new Map([["a", { id: "a", judge: "jev", version: "v", model: "m", best: "draw-gen", agreement: 0.67, at: "t", probabilities: { "photo-gen": 0.25, "draw-gen": 0.5, dflt: 0.25 } }]]);
const html = renderPickSheet(manifest, picks, "jev");

describe("renderPickSheet", () => {
  it("shows every image of every brief by its path in the run", () => {
    for (const item of manifest.items) for (const shot of item.shots) expect(html).toContain(`src="${shot.image}"`);
  });

  it("marks the pick and shows its probability and agreement", () => {
    expect(html.match(/class="best"/g)).toHaveLength(1);
    expect(html).toMatch(/class="best">[\s\S]*?draw-gen<\/div>[\s\S]*?class="pct">50%/);
    expect(html).toContain("agreement across orders 67%");
    expect(html).toContain("not picked yet");
  });

  it("escapes brief text", () => {
    expect(html).toContain("brief &lt;a&gt;");
    expect(html).not.toContain("brief <a>");
  });
});
