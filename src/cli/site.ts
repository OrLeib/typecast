// Builds the hosted site into site/: the home page, the results, the live routing and find-and-crop pages,
// the routing page's config, and the samples. The samples' default answers go into build/, where the functions read them.
import { execFile } from "node:child_process";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { parseArgs, promisify } from "node:util";
import sharp from "sharp";
import { loadEvidence } from "../demo/evidence.ts";
import { loadHomeStories } from "../demo/home-stories.ts";
import { homePage, OG_IMAGE_PATH, OG_SIZE } from "../demo/home.ts";
import { createLocateApi, DEFAULT_TARGET, findSamples, locatorIdOf } from "../demo/locate-api.ts";
import { locatePage } from "../demo/locate-page.ts";
import { PAGE_PATHS } from "../demo/page-style.ts";
import { demoPage } from "../demo/page.ts";
import { demoConfigOf } from "../demo/server.ts";
import { loadShootoutEvidence } from "../demo/shootout-evidence.ts";
import { showcasePage } from "../demo/showcase.ts";
import { loadBriefs } from "../evaluation/briefs.ts";
import { createLocalLineup } from "../generation/local-lineup.ts";
import { createJevClient, JEV_INPUT_PRICE_PER_MILLION } from "../jev/client.ts";
import { withRetries } from "../jev/retry.ts";
import { createJevPicker } from "../judging/jev-picker.ts";
import { createJevLocator, JEV_LOCATE_RETRIES } from "../locating/locator.ts";
import { DEFAULT_VARIANT, getVariant } from "../routing/variants.ts";
import { jevConfigFromEnv } from "./config.ts";

/** 1024px PNGs are about 1.2MB each; the page shows them at most about 500px wide, so 2x that as JPEG is plenty. */
const IMAGE_PX = "1000";
const JPEG_QUALITY = "80";
/** Only committed samples: runs/locating-samples holds images that aren't ours to publish. */
const SAMPLES_DIR = join("data", "locating");
/** Kept between builds and gitignored: only samples without an answer yet cost a Jev call. */
const BAKED_ANSWERS_DIR = join("build", "locate-answers");
/** The baked answers hold boxes, not crops, so any padding works; this is just what the bake request needs. */
const BAKE_PADDING = 0.5;
const OG_SOURCE = join("docs", "readme", "shootout-dark.jpg");

const { values: args } = parseArgs({ options: { out: { type: "string", default: "site" } } });
const run = promisify(execFile);
const jevConfig = jevConfigFromEnv();
const jev = createJevClient(jevConfig);

// Only the picker's id and prompt version are used, to read back its picks; nothing is picked here.
const shootout = await loadShootoutEvidence(join("runs", "shootout"), createJevPicker(jev));
if (!shootout) {
  console.error("No picked shootout under runs/shootout. Run `npm run generate -- --shootout`, then `npm run pick-jev -- <dir>`.");
  process.exit(1);
}
const evidence = await loadEvidence("runs", DEFAULT_VARIANT);

// Only generated files are cleared, so anything else kept in the folder survives a rebuild.
for (const generated of ["images", "locate-samples"]) {
  await rm(join(args.out, generated), { recursive: true, force: true });
  await mkdir(join(args.out, generated), { recursive: true });
}
const urls = new Map<string, string>();
for (const [url, file] of shootout.files) {
  const image = `images/${basename(file, ".png")}.jpg`;
  // sips ships with macOS, where the images are rendered anyway.
  await run("sips", ["-s", "format", "jpeg", "-s", "formatOptions", JPEG_QUALITY, "-Z", IMAGE_PX, file, "--out", join(args.out, image)]);
  urls.set(url, `/${image}`);
}
const briefs = shootout.evidence.briefs.map((brief) => ({ ...brief, shots: brief.shots.map((shot) => ({ ...shot, url: urls.get(shot.url) ?? shot.url })) }));
const hostedShootout = { ...shootout.evidence, briefs };
const stories = await loadHomeStories({ dir: shootout.dir, evidence: hostedShootout });
if (!stories.length) {
  console.error("No home stories yet. Run `npm run bake-home`.");
  process.exit(1);
}
await sharp(OG_SOURCE).resize(OG_SIZE.width, OG_SIZE.height, { fit: "cover", position: "top" }).jpeg({ quality: 82 }).toFile(join(args.out, OG_IMAGE_PATH.slice(1)));

await writePage(PAGE_PATHS.home, homePage({ stories, defaultGenerator: hostedShootout.defaultGenerator }));
await writePage(PAGE_PATHS.results, showcasePage({ evidence, shootout: hostedShootout }));
await writePage(PAGE_PATHS.route, demoPage({ hosted: true }));
await writePage(PAGE_PATHS.locate, locatePage({ hosted: true }));

const lineup = createLocalLineup();
const dev = await loadBriefs("data/dev.jsonl");
const config = demoConfigOf({
  roster: getVariant(DEFAULT_VARIANT).roster,
  // No rendering when hosted, but the page still names the model each category would use.
  generators: lineup.byCategory,
  defaultGenerator: lineup.fallback,
  evidence,
  examples: dev.map(({ brief, expected, note }) => ({ brief, expected, note })),
});
await writeFile(join(args.out, "demo-config.json"), JSON.stringify(config));

const samples = [...(await findSamples([SAMPLES_DIR])).keys()];
for (const name of samples) await copyFile(join(SAMPLES_DIR, name), join(args.out, "locate-samples", name));
const bake = createLocateApi({
  locator: createJevLocator(withRetries(jev, JEV_LOCATE_RETRIES)),
  locatorId: locatorIdOf(jevConfig),
  inputPricePerMillion: JEV_INPUT_PRICE_PER_MILLION,
  samplesDirs: [SAMPLES_DIR],
  cacheDir: BAKED_ANSWERS_DIR,
});
const baked = await Promise.all(samples.map((sample) => bake.locate({ sample, target: DEFAULT_TARGET, padding: BAKE_PADDING })));
const bakeCost = baked.reduce((sum, answer) => sum + answer.costUsd, 0);

console.log(`Site written to ${args.out}/ (${urls.size} shootout images, ${samples.length} samples).`);
console.log(`Sample answers in ${BAKED_ANSWERS_DIR}/ (${bakeCost ? `asked Jev, $${bakeCost.toFixed(5)}` : "all already baked"}).`);
console.log("Preview with: vercel deploy    Production: vercel deploy --prod");

/** A page at `path` is `path/index.html`, so its URL needs no extension. */
async function writePage(path: string, html: string) {
  await mkdir(join(args.out, path), { recursive: true });
  await writeFile(join(args.out, path, "index.html"), html);
}
