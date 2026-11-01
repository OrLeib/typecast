import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadManifest } from "../generation/manifest.ts";
import { JUDGMENTS_FILE, latestByPair, loadJudgments } from "../judging/judgments.ts";
import { formatWinRate } from "../judging/report.ts";
import { HUMAN_JUDGE } from "../judging/server.ts";
import { summarizeWinRate } from "../judging/win-rate.ts";

const { values: args, positionals } = parseArgs({ allowPositionals: true, options: { judge: { type: "string", default: HUMAN_JUDGE } } });
const [dir] = positionals;
if (!dir) {
  console.error("Usage: npm run judge-report -- <runs/level2/... dir> [--judge human]");
  process.exit(1);
}

const manifest = await loadManifest(dir);
const judgments = latestByPair(await loadJudgments(join(dir, JUDGMENTS_FILE)), args.judge);
for (const line of formatWinRate(summarizeWinRate(manifest.items, judgments), manifest.meta, args.judge)) console.log(line);
