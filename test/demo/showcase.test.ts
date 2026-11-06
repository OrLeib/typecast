import { describe, expect, it } from "vitest";
import type { Evidence } from "../../src/demo/evidence.ts";
import { modelName } from "../../src/demo/lightbox.ts";
import type { ShootoutBrief, ShootoutEvidence } from "../../src/demo/shootout-evidence.ts";
import { showcasePage } from "../../src/demo/showcase.ts";

const GENERATORS = ["mflux:photo@q8", "mflux:draw@q8", "mflux:dflt@q8"];
const DEFAULT = "mflux:dflt@q8";

function brief(id: string, routedGenerator: string, best: string, split = false): ShootoutBrief {
  return {
    id, brief: `brief <${id}>`, expected: "photoreal", routed: "photoreal", confidence: 0.9, routedGenerator, agreement: 0.8, split,
    shots: GENERATORS.map((generator) => ({ generator, url: `images/${id}-${modelName(generator)}.jpg`, probability: generator === best ? 0.6 : 0.2, picked: generator === best })),
  };
}

const shootout = (briefs: ShootoutBrief[]): ShootoutEvidence => ({
  run: "r", data: "data/dev.jsonl", defaultGenerator: DEFAULT, lineup: {}, picked: briefs.length, models: 3, meanAgreement: 0.8,
  bestWas: { routed: 0.5, expected: 0.5, default: 0.25 }, briefs,
});

const heldOut = (data: string, picked: number, compared: number) =>
  ({ data, n: 10, repeats: 3, metrics: { accuracy: 0.9 } as Evidence["metrics"], latencyP50: 200, costPer1000Usd: 0.026, outcomes: { picked, pickedRight: picked, compared, comparedInShortlist: compared - 1 } }) as unknown as Evidence;

const evidence = [heldOut("data/test.jsonl", 25, 5), heldOut("data/hard.jsonl", 20, 10), heldOut("data/dev.jsonl", 30, 0)];

const page = (briefs: ShootoutBrief[]) => showcasePage({ evidence, shootout: shootout(briefs) });

describe("showcasePage", () => {
  it("sums the held-out outcomes into the headline numbers", () => {
    const html = page([brief("a", "mflux:photo@q8", "mflux:photo@q8")]);
    expect(html).toContain("<b>45/45</b>");
    expect(html).toContain("<b>13/15</b>");
    expect(html).toContain("20 held-out briefs");
  });

  it("shows each image's scores and reports the second look, even when it disagrees with the pick", () => {
    const rated = brief("a", "mflux:photo@q8", "mflux:photo@q8");
    rated.shots[0].rating = { scores: { Brief: 0.6, Craft: 0.4 }, total: 0.5 };
    rated.shots[2].rating = { scores: { Brief: 0.9, Craft: 0.7 }, total: 0.8 };
    const html = showcasePage({ evidence, shootout: { ...shootout([rated]), rubric: { briefs: 1, topWas: { routed: 0, default: 1 }, agreesWithPick: 0 } } });
    expect(html).toContain("the routed model had the highest overall score on 0 of 1, the default on 1");
    expect(html).toContain("Highest overall score: dflt.");
    expect(html).toContain('<dt class="">Craft</dt>');
    expect(html).toContain("<dd class=\"\">40</dd>");
  });

  it("says nothing of scores for a run with none", () => {
    expect(page([brief("a", "mflux:photo@q8", "mflux:photo@q8")])).not.toContain("second look");
  });

  it("links the pages, marking this one", () => {
    const html = page([]);
    expect(html).toContain('<a href="/results" aria-current="page">The numbers</a>');
    expect(html).toContain('<a class="brand" href="/">');
  });

  it("says what the numbers count, and that the image sample was tuned on", () => {
    const html = page([brief("a", "mflux:photo@q8", "mflux:photo@q8")]);
    expect(html).toContain("matched the labelled category");
    expect(html).toContain("First picks matched the label on 90%");
    expect(html).toContain("briefs that routing was tuned on");
  });

  it("leaves out the images when no shootout is picked yet", () => {
    const html = showcasePage({ evidence });
    expect(html).toContain("<b>45/45</b>");
    expect(html).not.toContain("Does routing make better images?");
  });

  it("escapes briefs and shows the routed image beside the default one", () => {
    const html = page([brief("a", "mflux:photo@q8", "mflux:photo@q8")]);
    expect(html).toContain("brief &lt;a&gt;");
    expect(html).toMatch(/alt="Typecast's pick: photo"[\s\S]*alt="Default: dflt"/);
  });

  it("fills the second slot with the judge's favourite other image when routing chose the default", () => {
    expect(page([brief("a", DEFAULT, "mflux:draw@q8")])).toMatch(/Typecast's pick, also the default[\s\S]*Judge's pick/);
    expect(page([brief("a", DEFAULT, DEFAULT)])).toMatch(/Typecast's pick, also the default[\s\S]*Runner-up/);
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
