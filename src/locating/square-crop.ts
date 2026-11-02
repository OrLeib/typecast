// Turns a located box into the square crop a detail pass needs: centred on the target and padded so it isn't cut off.
import type { Box } from "../jev/parse.ts";

export type Size = { width: number; height: number };

/** A square in whole pixels from the image's top-left corner. It may run past the image's edges. */
export type SquareCrop = { left: number; top: number; size: number };

/**
 * `padding` is added on every side as a share of the box's longer edge, so 0.5 makes a square twice as wide as the
 * target. The square stays centred on the box even where that crosses the image's edge: sliding it back inside would
 * push the target off-centre, and a face that fills the photo would no longer sit in the middle of its crop.
 */
export function squareCrop(box: Box, image: Size, padding: number): SquareCrop {
  if (padding < 0) throw new Error(`padding must be 0 or more, got ${padding}`);
  const width = (box.right - box.left) * image.width;
  const height = (box.bottom - box.top) * image.height;
  const size = Math.max(1, Math.round(Math.max(width, height) * (1 + 2 * padding)));
  const centerX = ((box.left + box.right) / 2) * image.width;
  const centerY = ((box.top + box.bottom) / 2) * image.height;
  return { left: Math.round(centerX - size / 2), top: Math.round(centerY - size / 2), size };
}
