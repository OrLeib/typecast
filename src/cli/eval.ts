import { parseArgs } from "node:util";
import { loadBriefs } from "../evaluation/briefs.ts";
import { formatMisses, formatSummary, progressMark } from "../evaluation/report.ts";
import { runEval } from "../evaluation/runner.ts";
import { saveRun } from "../evaluation/runs.ts";
import { summarize } from "../evaluation/summary.ts";
import { createJevClient, JEV_INPUT_PRICE_PER_MILLION } from "../jev/client.ts";
import { createDecisionRouter } from "../routing/router.ts";
import { DEFAULT_VARIANT, getVariant } from "../routing/variants.ts";
import { currentCommit, jevConfigFromEnv } from "./config.ts";

const { values: args } = parseArgs({
  options: {
    data: { type: "string", default: "data/dev.jsonl" },
    variant: { type: "string", default: DEFAULT_VARIANT },
    repeats: { type: "string", default: "1" },
  },
});
const repeats = Number(args.repeats);
if (!Number.isInteger(repeats) || repeats < 1) throw new Error(`--repeats must be a positive integer, got ${args.repeats}`);

const router = createDecisionRouter(createJevClient(jevConfigFromEnv()), getVariant(args.variant));
const briefs = await loadBriefs(args.data);

const results = await runEval(router, briefs, repeats, (r) => {
  process.stdout.write(progressMark(r));
  if (r.id === briefs.at(-1)?.id) process.stdout.write("\n");
});

const meta = { data: args.data, variant: args.variant, repeats, commit: currentCommit() };
const summary = summarize(results, briefs, meta, JEV_INPUT_PRICE_PER_MILLION);
for (const line of [...formatSummary(summary), ...formatMisses(results)]) console.log(line);
console.log(`saved ${await saveRun("runs", { summary, results })}`);
