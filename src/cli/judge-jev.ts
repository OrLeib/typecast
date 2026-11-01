import { parseArgs } from "node:util";
import { loadManifest } from "../generation/manifest.ts";
import { createJevClient, JEV_INPUT_PRICE_PER_MILLION } from "../jev/client.ts";
import { withRetries } from "../jev/retry.ts";
import { autoJudgeRun } from "../judging/auto-judge.ts";
import { jevConfigFromEnv } from "./config.ts";

/** Image requests have hit brief 503 "Image processing is unavailable" answers that cleared on retry. */
const RETRIES = { attempts: 5, delayMs: 5000 };

const { positionals } = parseArgs({ allowPositionals: true });
const [dir] = positionals;
if (!dir) {
  console.error("Usage: npm run judge-jev -- <runs/level2/... dir>");
  process.exit(1);
}

const client = withRetries(createJevClient(jevConfigFromEnv()), RETRIES);
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const inputTokens = await autoJudgeRun(client, dir, await loadManifest(dir), {
  onJudged: (item, v) =>
    console.log(`  ${item.id.padEnd(5)} ${item.route.choice.padEnd(13)} ${v.winner.padEnd(8)} routed ${pct(v.probabilities.routed)}  default ${pct(v.probabilities.default)}  tie ${pct(v.probabilities.tie)}  (${v.model})`),
});
console.log(`spent ${inputTokens} input tokens ($${((inputTokens / 1e6) * JEV_INPUT_PRICE_PER_MILLION).toFixed(4)}). Report with: npm run judge-report -- ${dir} --judge jev`);
