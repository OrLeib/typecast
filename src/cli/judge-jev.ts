import { loadManifest } from "../generation/manifest.ts";
import { JEV_INPUT_PRICE_PER_MILLION } from "../jev/client.ts";
import { autoJudgeRun } from "../judging/auto-judge.ts";
import { createJevJudge } from "../judging/jev-judge.ts";
import { inputCostUsd } from "../shared/cost.ts";
import { percent } from "../shared/format.ts";
import { jevImageClientFromEnv, runDirArg } from "./config.ts";

const dir = runDirArg("npm run judge-jev -- <runs/level2/... dir>");

const judge = createJevJudge(jevImageClientFromEnv());
const pct = (x: number) => percent(x, 0);
const inputTokens = await autoJudgeRun(judge, dir, await loadManifest(dir), {
  onJudged: (item, v) =>
    console.log(`  ${item.id.padEnd(5)} ${item.route.choice.padEnd(13)} ${v.winner.padEnd(8)} routed ${pct(v.probabilities.routed)}  default ${pct(v.probabilities.default)}  tie ${pct(v.probabilities.tie)}  (${v.model})`),
});
console.log(`spent ${inputTokens} input tokens ($${inputCostUsd(inputTokens, JEV_INPUT_PRICE_PER_MILLION).toFixed(4)}). Report with: npm run judge-report -- ${dir} --judge ${judge.id}`);
