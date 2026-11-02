import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { cropSquare, prepareForJev, previewOf } from "../../src/locating/images.ts";

const solid = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#808080" } }).png().toBuffer();
const sizeOf = async (png: Buffer) => {
  const { width, height } = await sharp(png).metadata();
  return { width, height };
};

describe("prepareForJev", () => {
  it("scales a large image down to Jev's longest side as a JPEG, keeping its shape", async () => {
    const asset = await prepareForJev(await solid(3136, 2000));
    expect(asset.format).toBe("jpeg");
    expect((await sharp(Buffer.from(asset.data_base64, "base64")).metadata()).format).toBe("jpeg");
    expect(await sizeOf(Buffer.from(asset.data_base64, "base64"))).toEqual({ width: 1568, height: 1000 });
  });

  it("leaves an image that already fits at its size", async () => {
    const asset = await prepareForJev(await solid(1024, 1280));
    expect(await sizeOf(Buffer.from(asset.data_base64, "base64"))).toEqual({ width: 1024, height: 1280 });
  });

  it("rejects an image too thin to stay above Jev's shortest side", async () => {
    await expect(prepareForJev(await solid(4000, 200))).rejects.toThrow("shorter side must stay at least 280px");
  });
});

/** The alpha of the crop's pixel at (x, y). */
const alphaAt = async (png: Buffer, x: number, y: number) => {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return data[(y * info.width + x) * info.channels + 3];
};

describe("cropSquare", () => {
  it("cuts the requested square out of the original", async () => {
    const crop = await cropSquare(await solid(1000, 800), { left: 100, top: 50, size: 300 });
    expect(await sizeOf(crop)).toEqual({ width: 300, height: 300 });
    expect(await alphaAt(crop, 150, 150)).toBe(255);
  });

  it("keeps a square that runs past the image's edges at full size, transparent outside the image", async () => {
    const crop = await cropSquare(await solid(1000, 800), { left: -50, top: 700, size: 200 });
    expect(await sizeOf(crop)).toEqual({ width: 200, height: 200 });
    expect(await alphaAt(crop, 10, 10)).toBe(0);
    expect(await alphaAt(crop, 60, 50)).toBe(255);
    expect(await alphaAt(crop, 100, 150)).toBe(0);
  });

  it("refuses a square entirely outside the image", async () => {
    await expect(cropSquare(await solid(1000, 800), { left: 1200, top: 0, size: 100 })).rejects.toThrow("lies outside the 1000x800 image");
  });
});

describe("previewOf", () => {
  it("shrinks an image to fit a square of the given side as WebP, keeping transparency", async () => {
    const crop = await cropSquare(await solid(1000, 800), { left: -200, top: 0, size: 1000 });
    const preview = await previewOf(crop, 300);
    const meta = await sharp(preview).metadata();
    expect([meta.format, meta.width, meta.height, meta.hasAlpha]).toEqual(["webp", 300, 300, true]);
    expect(await alphaAt(preview, 5, 150)).toBe(0);
  });

  it("never enlarges a small image", async () => {
    const meta = await sharp(await previewOf(await solid(200, 200), 512)).metadata();
    expect([meta.width, meta.height]).toEqual([200, 200]);
  });
});
