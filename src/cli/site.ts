// Builds the hosted site into site/: the results showcase as the home page, the live routing and find-and-crop pages,
// the routing page's config, and the samples. The samples' default answers go into build/, where the functions read them.
import { execFile } from "node:child_process";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { parseArgs, promisify } from "node:util";
import { loadEvidence } from "../demo/evidence.ts";
import { createLocateApi, DEFAULT_TARGET, findSamples, locatorIdOf } from "../demo/locate-api.ts";
import { locatePage } from "../demo/locate-page.ts";
import { HOSTED_PATHS, pageLinks } from "../demo/page-style.ts";
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
import { PICK_THRESHOLD } from "../routing/recommendation.ts";
import { DEFAULT_VARIANT, getVariant } from "../routing/variants.ts";
import { jevConfigFromEnv } from "./config.ts";

const REPO_URL = "https://github.com/OrLeib/typecast";
/** Sets never tuned against (see "Measuring a change without overfitting" in CLAUDE.md). */
const HELD_OUT = new Set(["data/test.jsonl", "data/hard.jsonl"]);
/** 1024px PNGs are about 1.2MB each; the page shows them at most about 500px wide, so 2x that as JPEG is plenty. */
const IMAGE_PX = "1000";
const JPEG_QUALITY = "80";
/** Only committed samples: runs/locating-samples holds images that aren't ours to publish. */
const SAMPLES_DIR = join("data", "locating");
/** Kept between builds and gitignored: only samples without an answer yet cost a Jev call. */
const BAKED_ANSWERS_DIR = join("build", "locate-answers");
/** The baked answers hold boxes, not crops, so any padding works; this is just what the bake request needs. */
const BAKE_PADDING = 0.5;

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
const shootoutEvidence = { ...shootout.evidence, briefs };

const heldOut = evidence.filter((e) => HELD_OUT.has(e.data));
const links = pageLinks("results", HOSTED_PATHS);
await writeFile(join(args.out, "index.html"), showcasePage({ heldOut, shootout: shootoutEvidence, pickThreshold: PICK_THRESHOLD, repoUrl: REPO_URL, links, tryUrl: HOSTED_PATHS.route }));
await writePage(HOSTED_PATHS.route, demoPage({ paths: HOSTED_PATHS, hosted: true }));
await writePage(HOSTED_PATHS.locate, locatePage({ paths: HOSTED_PATHS, hosted: true }));

const lineup = createLocalLineup();
const dev = await loadBriefs("data/dev.jsonl");
const config = demoConfigOf({
  roster: getVariant(DEFAULT_VARIANT).roster,
  // No rendering when hosted, but the page still names the model each category would use.
  generators: lineup.byCategory,
  defaultGenerator: lineup.fallback,
  evidence,
  shootout: { evidence: shootoutEvidence, files: new Map() },
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
  bakedAnswerDirs: [],
});
const baked = await bake.locate({ samples, target: DEFAULT_TARGET, padding: BAKE_PADDING });

console.log(`Site written to ${args.out}/ (${urls.size} shootout images, ${samples.length} samples).`);
console.log(`Sample answers in ${BAKED_ANSWERS_DIR}/ (${baked.cached ? "all already baked" : `asked Jev, $${baked.costUsd.toFixed(5)}`}).`);
console.log("Preview with: vercel deploy    Production: vercel deploy --prod");

/** A page at `path` is `path/index.html`, so its URL needs no extension. */
async function writePage(path: string, html: string) {
  await mkdir(join(args.out, path), { recursive: true });
  await writeFile(join(args.out, path, "index.html"), html);
}
