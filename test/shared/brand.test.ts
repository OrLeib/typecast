import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FAVICON_LINK, logoMark } from "../../src/shared/brand.ts";

const pathsOf = (svg: string) => [...svg.matchAll(/ d="([^"]+)"/g)].map((match) => match[1]).sort();

describe("brand", () => {
  it("draws the same mark as docs/brand/logo.svg", () => {
    const logoFile = readFileSync(new URL("../../docs/brand/logo.svg", import.meta.url), "utf8");
    expect(pathsOf(logoMark(24))).toEqual(pathsOf(logoFile));
  });

  it("embeds the mark in the favicon link", () => {
    const href = /href="data:image\/svg\+xml,([^"]+)"/.exec(FAVICON_LINK)?.[1];
    expect(pathsOf(decodeURIComponent(href ?? ""))).toEqual(pathsOf(logoMark(24)));
  });
});
