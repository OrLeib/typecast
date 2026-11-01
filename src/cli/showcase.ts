import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { parseArgs, promisify } from "node:util";
import { loadEvidence } from "../demo/evidence.ts";
import { loadShootoutEvidence } from "../demo/shootout-evidence.ts";
import { showcasePage } from "../demo/showcase.ts";
import { createJevClient } from "../jev/client.ts";
import { createJevPicker } from "../judging/jev-picker.ts";
import { PICK_THRESHOLD } from "../routing/recommendation.ts";
import { DEFAULT_VARIANT } from "../routing/variants.ts";
import { jevConfigFromEnv } from "./config.ts";

const REPO_URL = "https://github.com/OrLeib/typecast";
/** Sets never tuned against (see "Measuring a change without overfitting" in CLAUDE.md). */
const HELD_OUT = new Set(["data/test.jsonl", "data/hard.jsonl"]);
/** 1024px PNGs are about 1.2MB each; the page shows them at most about 500px wide, so 2x that as JPEG is plenty. */
const IMAGE_PX = "1000";
const JPEG_QUALITY = "80";

const { values: args } = parseArgs({ options: { out: { type: "string", default: "site" } } });
const run = promisify(execFile);

// Only the picker's id and prompt version are used, to read back its picks; nothing is picked here.
const shootout = await loadShootoutEvidence(join("runs", "shootout"), createJevPicker(createJevClient(jevConfigFromEnv())));
if (!shootout) {
  console.error("No picked shootout under runs/shootout. Run `npm run generate -- --shootout`, then `npm run pick-jev -- <dir>`.");
  process.exit(1);
}
const heldOut = (await loadEvidence("runs", DEFAULT_VARIANT)).filter((e) => HELD_OUT.has(e.data));

// Only the generated files are cleared: site/.vercel links the folder to its Vercel project.
await rm(join(args.out, "images"), { recursive: true, force: true });
await mkdir(join(args.out, "images"), { recursive: true });
const urls = new Map<string, string>();
for (const [url, file] of shootout.files) {
  const image = `images/${basename(file, ".png")}.jpg`;
  // sips ships with macOS, where the images are rendered anyway.
  await run("sips", ["-s", "format", "jpeg", "-s", "formatOptions", JPEG_QUALITY, "-Z", IMAGE_PX, file, "--out", join(args.out, image)]);
  urls.set(url, image);
}
const briefs = shootout.evidence.briefs.map((brief) => ({ ...brief, shots: brief.shots.map((shot) => ({ ...shot, url: urls.get(shot.url) ?? shot.url })) }));

await writeFile(join(args.out, "index.html"), showcasePage({ heldOut, shootout: { ...shootout.evidence, briefs }, pickThreshold: PICK_THRESHOLD, repoUrl: REPO_URL }));
console.log(`Showcase written to ${args.out}/ (${urls.size} images). Deploy with: vercel deploy ${args.out}`);
