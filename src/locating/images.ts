// Image IO through sharp: fit an image into what Jev accepts, and cut a square out of the original.
import sharp from "sharp";
import type { ImageAsset } from "../jev/parse.ts";
import type { Size, SquareCrop } from "./square-crop.ts";

/** Jev's limits on an image's sides. */
const MAX_SIDE = 1568;
const MIN_SIDE = 280;

/**
 * JPEG, not PNG: a 1568px photo is 0.23 MB instead of 3.7 MB, which cut a request from 1.3s to 0.35s with the same box,
 * confidence and input tokens (jev-1.14.0, 2026-11-01). Jev bills by image size, not bytes.
 */
const JPEG_QUALITY = 85;

export type PreparedImage = { asset: ImageAsset; size: Size };

/**
 * Scales the image down until both sides fit Jev's limits and re-encodes it as JPEG. The aspect ratio is kept, so the
 * box's fractions apply to the original image too. `size` is the original's, upright.
 */
export async function prepareForJev(original: Buffer): Promise<PreparedImage> {
  const size = await uprightSize(original);
  const scale = Math.min(1, MAX_SIDE / Math.max(size.width, size.height));
  const width = Math.round(size.width * scale);
  const height = Math.round(size.height * scale);
  if (Math.min(width, height) < MIN_SIDE) {
    throw new Error(`image is ${size.width}x${size.height}; its shorter side must stay at least ${MIN_SIDE}px once it fits in ${MAX_SIDE}px`);
  }
  const jpeg = await sharp(original).rotate().resize(width, height).jpeg({ quality: JPEG_QUALITY }).toBuffer();
  return { asset: { type: "image", format: "jpeg", data_base64: jpeg.toString("base64") }, size };
}

/** Honours EXIF orientation, so sizes match what a browser shows. */
export async function uprightSize(image: Buffer): Promise<Size> {
  const { width, height, orientation } = await sharp(image).metadata();
  if (!width || !height) throw new Error("could not read the image's size");
  const turned = orientation !== undefined && orientation >= 5;
  return turned ? { width: height, height: width } : { width, height };
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** Cuts the square out of the original as a PNG. Any part past the image's edges is transparent, so the target stays centred. */
export async function cropSquare(original: Buffer, crop: SquareCrop): Promise<Buffer> {
  const size = await uprightSize(original);
  const left = Math.max(0, crop.left);
  const top = Math.max(0, crop.top);
  const right = Math.min(size.width, crop.left + crop.size);
  const bottom = Math.min(size.height, crop.top + crop.size);
  if (right <= left || bottom <= top) throw new Error(`crop ${JSON.stringify(crop)} lies outside the ${size.width}x${size.height} image`);
  const inside = await sharp(original).rotate().extract({ left, top, width: right - left, height: bottom - top }).ensureAlpha().png().toBuffer();
  const margins = { left: left - crop.left, top: top - crop.top, right: crop.left + crop.size - right, bottom: crop.top + crop.size - bottom };
  return sharp(inside).extend({ ...margins, background: TRANSPARENT }).png().toBuffer();
}

/** WebP keeps the crop's transparent margins at a fraction of a PNG's size. */
const PREVIEW_QUALITY = 82;

/** A copy of `image` that fits a `side`-pixel square, for showing on a page: a 2400px PNG crop is several MB, its preview tens of KB. */
export async function previewOf(image: Buffer, side: number): Promise<Buffer> {
  return sharp(image).resize(side, side, { fit: "inside", withoutEnlargement: true }).webp({ quality: PREVIEW_QUALITY }).toBuffer();
}
