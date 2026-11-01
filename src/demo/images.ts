// How the demo names the images it renders. A name is a content hash, so the only image URLs the demo accepts back
// are ones it could have handed out, and a repeat render of the same brief, model and seed is a cache hit.
import { SHORT_HASH_CHARS, shortHash } from "../shared/hash.ts";

const IMAGE_URL = new RegExp(`^/images/([0-9a-f]{${SHORT_HASH_CHARS}}\\.png)$`);

/** Same brief, model and seed always give the same image, so they name its file. */
export const imageFileFor = (generatorName: string, seed: number, brief: string) => `${shortHash(`${generatorName}\n${seed}\n${brief}`)}.png`;

export const imageUrl = (file: string) => `/images/${file}`;

/** The file an image URL names, or undefined when the URL is not one the demo hands out. */
export const imageFileFromUrl = (url: unknown) => (typeof url === "string" ? IMAGE_URL.exec(url)?.[1] : undefined);
