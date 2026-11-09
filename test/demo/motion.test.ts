import { describe, expect, it } from "vitest";
import { homePage } from "../../src/demo/home.ts";
import { locatePage } from "../../src/demo/locate-page.ts";
import { WITH_MOTION } from "../../src/demo/page-style.ts";
import { demoPage } from "../../src/demo/page.ts";
import { showcasePage } from "../../src/demo/showcase.ts";
import { shootoutOf, story } from "./fixtures.ts";

// Real stories, because empty ones would skip the markup and its style attributes.
const sureStory = story("sure", 0.95, "a", "a");
const unsureStory = story("unsure", 0.47, "a", "b");

const PAGES = {
  home: homePage({ stories: [sureStory, unsureStory], defaultGenerator: "c" }),
  route: demoPage({ hosted: false }),
  locate: locatePage({ hosted: false }),
  results: showcasePage({ shootout: shootoutOf([sureStory.brief, unsureStory.brief], "c") }),
};

/** Not motion by WCAG's definition, so these may change for everyone. */
const STILL_PROPERTIES = ["opacity", "color", "background", "background-color", "border-color", "outline-color", "box-shadow"];

/** The block opening at `start`, up to its matching brace. */
function blockEnd(css: string, start: number) {
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return i + 1;
  }
  throw new Error("Unbalanced braces in a page's style");
}

function withoutBlocks(css: string, opening: string) {
  let rest = css;
  for (let start = rest.indexOf(opening); start !== -1; start = rest.indexOf(opening)) rest = rest.slice(0, start) + rest.slice(blockEnd(rest, start));
  return rest;
}

const valuesOf = (text: string, property: string) => [...text.matchAll(new RegExp(`(?<![-\\w])${property}:([^;}"]+)`, "g"))].map(([, value]) => value.trim());

/** A transition that names no property, such as `.2s`, is transitioning everything. */
const transitionedBy = (value: string) => value.split(",").map((part) => (/^[\d.]/.test(part.trim()) ? "all" : part.trim().split(/\s+/)[0]));

const keyframesOf = (text: string) =>
  [...text.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => ({ name: match[1], body: text.slice(match.index, blockEnd(text, match.index)) }));

describe.each(Object.entries(PAGES))("the %s page without motion", (_, html) => {
  // The whole page, not just its stylesheet: motion can also hide in a style attribute or a script.
  const still = withoutBlocks(html, WITH_MOTION);

  it("only keeps keyframes that change opacity", () => {
    const declared = keyframesOf(still).flatMap(({ body }) => [...body.matchAll(/([\w-]+):/g)].map(([, property]) => property));
    expect(declared.filter((property) => property !== "opacity")).toEqual([]);
  });

  it("only plays those keyframes", () => {
    const allowed = keyframesOf(still).map(({ name }) => name);
    const names = [...valuesOf(still, "animation"), ...valuesOf(still, "animation-name")].map((value) => value.split(/\s+/)[0]);
    expect(names.filter((name) => !allowed.includes(name))).toEqual([]);
  });

  it("transitions nothing that moves", () => {
    const shorthand = valuesOf(still, "transition").flatMap(transitionedBy);
    const longhand = valuesOf(still, "transition-property").flatMap((value) => value.split(",").map((part) => part.trim()));
    expect([...shorthand, ...longhand].filter((property) => !STILL_PROPERTIES.includes(property))).toEqual([]);
  });

  it("leaves smooth scrolling to the query", () => {
    expect(still).not.toMatch(/behavior:\s*["']?smooth/);
  });

  it("leaves animation to CSS, which follows a changed setting by itself", () => {
    expect(html).not.toMatch(/\.animate\(|startViewTransition/);
  });
});

it("the guard reads each page's real markup", () => {
  expect(PAGES.home).toContain('style="--i:');
  expect(PAGES.results).toContain("/a.jpg");
});

it("the guard sees through nested blocks", () => {
  const css = `a { color: red; } ${WITH_MOTION} { @keyframes x { from { opacity: 0; } } b { top: 0; } } c { color: blue; }`;
  expect(withoutBlocks(css, WITH_MOTION)).toBe("a { color: red; }  c { color: blue; }");
});

describe.each(Object.entries(PAGES))("arriving on the %s page", (_, html) => {
  // Overlaying two unrelated layouts through snapshots that aren't opaque washes the page out, and once flashed it white.
  it("swaps the page in place of crossfading it", () => {
    expect(html).toContain("@view-transition { navigation: auto; }");
    expect(html).toContain("::view-transition-old(root) { display: none; }");
    expect(html).toContain("::view-transition-new(root) { animation: none; }");
  });

  it("doesn't fade a whole story in on arrival", () => {
    expect(html).not.toMatch(/(^|[{};/])\s*article\s*\{[^}]*animation/m);
  });
});
