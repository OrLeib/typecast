import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadManifest } from "../generation/manifest.ts";
import { agreement } from "../judging/agreement.ts";
import { HUMAN_JUDGE, JUDGMENTS_FILE, latestByPair, loadJudgments } from "../judging/judgments.ts";
import { formatAgreement, formatWinRate } from "../judging/report.ts";
import { summarizeWinRate } from "../judging/win-rate.ts";

const { values: args, positionals } = parseArgs({ allowPositionals: true, options: { judge: { type: "string", default: HUMAN_JUDGE } } });
const [dir] = positionals;
if (!dir) {
  console.error("Usage: npm run judge-report -- <runs/level2/... dir> [--judge human|jev]");
  process.exit(1);
}

const manifest = await loadManifest(dir);
const all = await loadJudgments(join(dir, JUDGMENTS_FILE));
const judgments = latestByPair(all, args.judge);
for (const line of formatWinRate(summarizeWinRate(manifest.items, judgments), manifest.meta, args.judge)) console.log(line);
// An auto-judge is only worth trusting as far as it matches hand judging on the same pairs.
const human = latestByPair(all, HUMAN_JUDGE);
if (args.judge !== HUMAN_JUDGE && human.size) console.log(formatAgreement(agreement(judgments, human), args.judge, HUMAN_JUDGE));
