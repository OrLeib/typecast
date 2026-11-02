import { describe, expect, it } from "vitest";
import type { Evidence } from "../../src/demo/evidence.ts";
import type { ShootoutBrief, ShootoutEvidence } from "../../src/demo/shootout-evidence.ts";
import { modelName, showcasePage } from "../../src/demo/showcase.ts";

const GENERATORS = ["mflux:photo@q8", "mflux:draw@q8", "mflux:dflt@q8"];
const DEFAULT = "mflux:dflt@q8";

function brief(id: string, routedGenerator: string, best: string, split = false): ShootoutBrief {
  return {
    id, brief: `brief <${id}>`, expected: "photoreal", routed: "photoreal", confidence: 0.9, routedGenerator, agreement: 0.8, split,
    shots: GENERATORS.map((generator) => ({ generator, url: `images/${id}-${modelName(generator)}.jpg`, probability: generator === best ? 0.6 : 0.2, picked: generator === best })),
  };
}

const shootout = (briefs: ShootoutBrief[]): ShootoutEvidence => ({
  run: "r", data: "data/dev.jsonl", defaultGenerator: DEFAULT, picked: briefs.length, models: 3, meanAgreement: 0.8,
  bestWas: { routed: 0.5, expected: 0.5, default: 0.25 }, briefs,
});

const heldOut = (data: string, picked: number, compared: number) =>
  ({ data, n: 10, repeats: 3, latencyP50: 200, costPer1000Usd: 0.026, outcomes: { picked, pickedRight: picked, compared, comparedInShortlist: compared - 1 } }) as Evidence;

const page = (briefs: ShootoutBrief[]) =>
  showcasePage({ heldOut: [heldOut("data/test.jsonl", 25, 5), heldOut("data/hard.jsonl", 20, 10)], shootout: shootout(briefs), pickThreshold: 0.85, repoUrl: "https://example.com/r", links: '<a href="/demo">Route a brief</a>', tryUrl: "/demo" });

describe("showcasePage", () => {
  it("sums the held-out outcomes into the headline numbers", () => {
    const html = page([brief("a", "mflux:photo@q8", "mflux:photo@q8")]);
    expect(html).toContain("<b>45/45</b>");
    expect(html).toContain("<b>13/15</b>");
    expect(html).toContain("20 held-out briefs");
  });

  it("escapes briefs and shows the routed image beside the default one", () => {
    const html = page([brief("a", "mflux:photo@q8", "mflux:photo@q8")]);
    expect(html).toContain("brief &lt;a&gt;");
    expect(html).toMatch(/alt="Routed: photo"[\s\S]*alt="Default: dflt"/);
  });

  it("fills the second slot with the judge's favourite other image when routing chose the default", () => {
    expect(page([brief("a", DEFAULT, "mflux:draw@q8")])).toMatch(/Routed, also the default[\s\S]*Judge's pick/);
    expect(page([brief("a", DEFAULT, DEFAULT)])).toMatch(/Routed, also the default[\s\S]*Runner-up/);
  });

  it("says outright whether the judge picked the routed model, the default, or neither", () => {
    expect(page([brief("a", "mflux:photo@q8", "mflux:photo@q8")])).toContain("Judge's pick: the routed model</b> (photo)");
    expect(page([brief("a", "mflux:photo@q8", DEFAULT)])).toContain("Routing missed.</b> Judge's pick: dflt, the default model.");
    expect(page([brief("a", "mflux:photo@q8", "mflux:draw@q8")])).toContain("Judge's pick: draw, neither the routed nor the default model.");
  });

  it("leads with clear routed wins, then split calls, then losses, and keeps every brief", () => {
    const html = page([brief("loss", "mflux:photo@q8", DEFAULT), brief("split", "mflux:photo@q8", "mflux:photo@q8", true), brief("win", "mflux:photo@q8", "mflux:photo@q8")]);
    const at = (id: string) => html.indexOf(`brief &lt;${id}&gt;`);
    expect(at("win")).toBeLessThan(at("split"));
    expect(at("split")).toBeLessThan(at("loss"));
  });
});
