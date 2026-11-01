import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadEvidence } from "../demo/evidence.ts";
import { loadShootoutEvidence } from "../demo/shootout-evidence.ts";
import { createDemoServer } from "../demo/server.ts";
import { loadBriefs } from "../evaluation/briefs.ts";
import { createLocalLineup } from "../generation/local-lineup.ts";
import { createJevClient, JEV_INPUT_PRICE_PER_MILLION } from "../jev/client.ts";
import { withRetries } from "../jev/retry.ts";
import { createJevJudge } from "../judging/jev-judge.ts";
import { createJevPicker } from "../judging/jev-picker.ts";
import { createDecisionRouter } from "../routing/router.ts";
import { DEFAULT_VARIANT, getVariant } from "../routing/variants.ts";
import { jevConfigFromEnv } from "./config.ts";

const DEMO_DIR = join("runs", "demo");

const { values: args } = parseArgs({ options: { port: { type: "string", default: process.env.PORT ?? "4180" }, seed: { type: "string", default: "1" } } });

const variant = getVariant(DEFAULT_VARIANT);
const dev = await loadBriefs("data/dev.jsonl");
const imagesDir = join(DEMO_DIR, "images");
await mkdir(imagesDir, { recursive: true });

/** Image requests to Jev have hit brief 503s; a short retry keeps the judge button from failing on one. */
const JUDGE_RETRIES = { attempts: 3, delayMs: 1500 };

const jevConfig = jevConfigFromEnv();
const jev = createJevClient(jevConfig);
const lineup = createLocalLineup();
const server = createDemoServer({
  router: createDecisionRouter(jev, variant),
  roster: variant.roster,
  generators: lineup.byCategory,
  defaultGenerator: lineup.fallback,
  judge: createJevJudge(withRetries(jev, JUDGE_RETRIES)),
  evidence: await loadEvidence("runs", DEFAULT_VARIANT),
  // Only the picker's id and prompt version are used, to read back its picks; the demo never picks live.
  shootout: await loadShootoutEvidence(join("runs", "shootout"), createJevPicker(jev)),
  examples: dev.map(({ brief, expected, note }) => ({ brief, expected, note })),
  inputPricePerMillion: JEV_INPUT_PRICE_PER_MILLION,
  imagesDir,
  cacheDir: join(DEMO_DIR, "cache"),
  routerId: JSON.stringify({ variant, model: jevConfig.model, baseUrl: jevConfig.baseUrl }),
  seed: Number(args.seed),
});
server.listen(Number(args.port), "127.0.0.1", () => console.log(`Typecast demo at http://localhost:${args.port}  (Ctrl+C to stop)`));
