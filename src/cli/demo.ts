import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadEvidence } from "../demo/evidence.ts";
import { createDemoServer } from "../demo/server.ts";
import { loadBriefs } from "../evaluation/briefs.ts";
import { LOCAL_LINEUP } from "../generation/local-lineup.ts";
import { createMfluxGenerator } from "../generation/mflux.ts";
import { createJevClient, JEV_INPUT_PRICE_PER_MILLION } from "../jev/client.ts";
import { createDecisionRouter } from "../routing/router.ts";
import { DEFAULT_VARIANT, getVariant } from "../routing/variants.ts";
import { jevConfigFromEnv } from "./config.ts";

/** Dev briefs offered as one-click examples: one per category, two of them labelled borderline. */
const EXAMPLE_IDS = ["b01", "b02", "b03", "b77", "b90", "b20"];
const DEMO_DIR = join("runs", "demo");

const { values: args } = parseArgs({ options: { port: { type: "string", default: process.env.PORT ?? "4180" }, seed: { type: "string", default: "1" } } });

const variant = getVariant(DEFAULT_VARIANT);
const dev = await loadBriefs("data/dev.jsonl");
const imagesDir = join(DEMO_DIR, "images");
await mkdir(imagesDir, { recursive: true });

const server = createDemoServer({
  router: createDecisionRouter(createJevClient(jevConfigFromEnv()), variant),
  roster: variant.roster,
  generators: Object.fromEntries(Object.entries(LOCAL_LINEUP).map(([category, model]) => [category, createMfluxGenerator(model)])),
  evidence: await loadEvidence("runs", DEFAULT_VARIANT),
  examples: EXAMPLE_IDS.flatMap((id) => dev.filter((b) => b.id === id).map((b) => b.brief)),
  inputPricePerMillion: JEV_INPUT_PRICE_PER_MILLION,
  imagesDir,
  seed: Number(args.seed),
});
server.listen(Number(args.port), "127.0.0.1", () => console.log(`Typecast demo at http://localhost:${args.port}  (Ctrl+C to stop)`));
