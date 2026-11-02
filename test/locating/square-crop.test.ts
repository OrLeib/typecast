import { describe, expect, it } from "vitest";
import { squareCrop } from "../../src/locating/square-crop.ts";

const image = { width: 1000, height: 800 };

describe("squareCrop", () => {
  it("centres a square on the box, sized by its longer edge plus padding on each side", () => {
    // Box is 100 x 80 px centred at (500, 400); padding 0.5 adds 50 px a side to the longer edge.
    const crop = squareCrop({ left: 0.45, right: 0.55, top: 0.45, bottom: 0.55 }, image, 0.5);
    expect(crop).toEqual({ left: 400, top: 300, size: 200 });
  });

  it("stays centred on a box at the image's edge, running past it", () => {
    // Box is 100 x 80 px centred at (50, 760).
    const crop = squareCrop({ left: 0, right: 0.1, top: 0.9, bottom: 1 }, image, 0.5);
    expect(crop).toEqual({ left: -50, top: 660, size: 200 });
  });

  it("stays centred on a box larger than the image's shorter side, rather than shrinking off-centre", () => {
    // A face filling a portrait: 670 x 688 px centred at (555, 400).
    const crop = squareCrop({ left: 0.22, right: 0.89, top: 0.07, bottom: 0.93 }, image, 0.5);
    expect(crop.size).toBe(1376);
    expect(crop.left + crop.size / 2).toBe(555);
    expect(crop.top + crop.size / 2).toBe(400);
  });

  it("rejects negative padding", () => {
    expect(() => squareCrop({ left: 0.4, right: 0.6, top: 0.4, bottom: 0.6 }, image, -0.1)).toThrow("padding must be 0 or more, got -0.1");
  });
});
