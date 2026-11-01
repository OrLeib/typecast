// What the Jev judges share: how an image is sent, and what makes one image fulfil a brief better than another.
import type { ImageAsset } from "../jev/parse.ts";
import type { JudgedImage } from "./pair-judge.ts";

/** Part of every judge's prompt, so the pair judge and the picker weigh images the same way. */
export const WHAT_COUNTS =
  "Weigh how faithfully it follows the brief (subject, style, mood, composition, and any text that must be legible) and its " +
  "visual quality (no artifacts, distortions or garbled details).";

export const toAsset = (image: JudgedImage): ImageAsset => ({ type: "image", format: image.format, data_base64: image.data.toString("base64") });
