import { parseArgs } from "node:util";
import { loadBriefs } from "../evaluation/briefs.ts";
import { formatMisses, formatSummary, progressMark } from "../evaluation/report.ts";
import { runEval } from "../evaluation/runner.ts";
import { saveRun } from "../evaluation/runs.ts";
import { summarize } from "../evaluation/summary.ts";
import { createJevClient, JEV_INPUT_PRICE_PER_MILLION } from "../jev/client.ts";
import { createKeywordRouter } from "../routing/keyword-router.ts";
import { ROSTER } from "../routing/roster.ts";
import { createDecisionRouter, type Router } from "../routing/router.ts";
import { DEFAULT_VARIANT, getVariant } from "../routing/variants.ts";
import { currentCommit, jevConfigFromEnv } from "./config.ts";

const { values: args } = parseArgs({
  options: {
    data: { type: "string", default: "data/dev.jsonl" },
    router: { type: "string", default: "jev" },
    variant: { type: "string" },
    repeats: { type: "string", default: "1" },
  },
});
const repeats = Number(args.repeats);
if (!Number.isInteger(repeats) || repeats < 1) throw new Error(`--repeats must be a positive integer, got ${args.repeats}`);

const { router, label, inputPrice } = buildRouter(args.router, args.variant);
const briefs = await loadBriefs(args.data);

const results = await runEval(router, briefs, repeats, (r) => {
  process.stdout.write(progressMark(r));
  if (r.id === briefs.at(-1)?.id) process.stdout.write("\n");
});

const meta = { data: args.data, variant: label, repeats, commit: currentCommit() };
const summary = summarize(results, briefs, meta, inputPrice);
for (const line of [...formatSummary(summary), ...formatMisses(results)]) console.log(line);
console.log(`saved ${await saveRun("runs", { summary, results })}`);

/** `jev` routes with a decision model and a variant; `keyword` is the model-free difficulty probe. */
function buildRouter(kind: string, variant: string | undefined): { router: Router; label: string; inputPrice: number } {
  if (kind === "keyword") {
    if (variant) throw new Error("--variant applies to --router jev only");
    return { router: createKeywordRouter(Object.keys(ROSTER)), label: "keyword", inputPrice: 0 };
  }
  if (kind !== "jev") throw new Error(`Unknown router "${kind}". Known: jev, keyword`);
  const name = variant ?? DEFAULT_VARIANT;
  return { router: createDecisionRouter(createJevClient(jevConfigFromEnv()), getVariant(name)), label: name, inputPrice: JEV_INPUT_PRICE_PER_MILLION };
}
