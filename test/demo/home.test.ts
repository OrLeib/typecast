import { describe, expect, it } from "vitest";
import type { HomeStory } from "../../src/demo/home-stories.ts";
import { homePage } from "../../src/demo/home.ts";
import { story } from "./fixtures.ts";

const page = (...stories: HomeStory[]) => homePage({ stories, defaultGenerator: "c" });

describe("homePage", () => {
  it("shows only the first story, with a chip for each", () => {
    const html = page(story("one", 0.95, "a", "a"), story("two", 0.95, "a", "a"));
    expect(html.match(/<article/g)).toHaveLength(2);
    expect(html.match(/<article hidden/g)).toHaveLength(1);
    expect(html).toContain('aria-pressed="true">one<');
    expect(html).toContain('aria-pressed="false">two<');
  });

  it("just uses a confident route's model", () => {
    const html = page(story("sure", 0.95, "a", "a"));
    expect(html).toContain("95% sure it fits: just use it");
    expect(html).not.toContain(">or<");
  });

  it("names both models and shows both images when routing is unsure", () => {
    const html = page(story("unsure", 0.47, "a", "a"));
    expect(html).toContain("47% sure it fits: show the top two");
    expect(html).toContain("<span>or</span> c");
    expect(html).toContain('<div class="shots routed">');
  });

  it("says why a pick was made, and what would settle an unsure route", () => {
    expect(page(story("sure", 0.95, "a", "a"))).toContain("Why: Real-world scene");
    expect(page(story("unsure", 0.47, "a", "a"))).toContain("Would settle it: Real-world scene or Words must be readable");
  });

  it("says nothing about why when the checks don't back the pick", () => {
    expect(page({ ...story("quiet", 0.95, "a", "a"), explanation: { because: [], open: [] } })).not.toContain('class="why"');
  });

  it("never claims certainty", () => {
    expect(page(story("certain", 1, "a", "a"))).toContain("99%+ sure it fits");
  });

  it("credits the best image to the judge, not to fact", () => {
    const hit = page(story("hit", 0.95, "a", "a"));
    expect(hit).toContain("the judge agreed with the pick");
    expect(hit).toContain("Typecast's pick");
    expect(hit).toContain("Judge's pick");
    expect(page(story("miss", 0.95, "a", "b"))).toContain("the judge preferred b's image");
  });

  it("keeps a large crop inside the image", () => {
    const html = page({ ...story("big", 0.95, "a", "a"), box: { top: 0.1, bottom: 0.9, left: 0.3, right: 0.7 } });
    expect(html).toContain('style="width:100.00%;left:0.00%;top:0.00%;');
  });

  it("escapes briefs and targets", () => {
    const html = page(story("x", 0.95, "a", "a"));
    expect(html).toContain("brief &lt;x&gt;");
    expect(html).not.toContain("the <x>");
  });

  it("says what Typecast is", () => {
    expect(page()).toContain('<p class="lede">Typecast is a decision layer for AI image tools');
  });

  it("has no numbers besides the confidence, and links to them", () => {
    const html = page(story("x", 0.95, "a", "a"));
    expect(html).toContain('href="/results"');
    expect(html).not.toContain("604");
  });

  it("gives a shared link a preview image", () => {
    expect(page()).toContain('property="og:image" content="https://typecast-ai.vercel.app/og.jpg"');
  });

  it("serves a page script that parses", () => {
    for (const [, script] of page().matchAll(/<script>([\s\S]*?)<\/script>/g)) expect(() => new Function(script)).not.toThrow();
  });
});
