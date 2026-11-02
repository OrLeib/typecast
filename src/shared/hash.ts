import { createHash } from "node:crypto";

/** Hex characters of the sha256 kept: plenty to never collide among a local tool's files. */
export const SHORT_HASH_CHARS = 16;

/** A short, stable, file-name-safe digest of `content`. */
export const shortHash = (content: string | Buffer) => createHash("sha256").update(content).digest("hex").slice(0, SHORT_HASH_CHARS);
