import { isBorderline, loadBriefs } from "../evaluation/briefs.ts";
import { loadRun } from "../evaluation/runs.ts";
import { compareRuns } from "../comparison/compare.ts";
import { formatComparison } from "../comparison/report.ts";

const [fileA, fileB] = process.argv.slice(2);
if (!fileA || !fileB) {
  console.error("Usage: npm run compare -- <baseline run.json> <candidate run.json>");
  process.exit(1);
}

const [a, b] = await Promise.all([loadRun(fileA), loadRun(fileB)]);
if (a.summary.data !== b.summary.data) throw new Error(`Runs use different data files: ${a.summary.data} vs ${b.summary.data}`);
const briefs = await loadBriefs(a.summary.data);
const comparison = compareRuns(a.results, b.results, { borderline: new Set(briefs.filter(isBorderline).map((x) => x.id)) });
for (const line of formatComparison(comparison, a.summary, b.summary)) console.log(line);
