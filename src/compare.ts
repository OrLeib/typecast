import { isBorderline, loadBriefs } from "./briefs.ts";
import { compareRuns } from "./comparison.ts";
import { loadRun } from "./runs.ts";

const [fileA, fileB] = process.argv.slice(2);
if (!fileA || !fileB) {
  console.error("Usage: npm run compare -- <baseline run.json> <candidate run.json>");
  process.exit(1);
}

const [a, b] = await Promise.all([loadRun(fileA), loadRun(fileB)]);
if (a.summary.data !== b.summary.data) throw new Error(`Runs use different data files: ${a.summary.data} vs ${b.summary.data}`);
const briefs = await loadBriefs(a.summary.data);
const c = compareRuns(a.results, b.results, new Set(briefs.filter(isBorderline).map((x) => x.id)));

const describe = (s: typeof a.summary) => `${s.variant} x${s.repeats} @${s.commit} (${s.model})`;
console.log(`${a.summary.data}, n=${c.n}`);
console.log(`A: ${describe(a.summary)}`);
console.log(`B: ${describe(b.summary)}\n`);

const f = (x: number) => x.toFixed(3);
console.log(`${"metric".padEnd(27)}${"A".padStart(8)}${"B".padStart(8)}${"B-A".padStart(9)}   95% CI`);
for (const m of c.metrics) {
  const better = m.lowerIsBetter ? m.ci[1] < 0 : m.ci[0] > 0;
  const worse = m.lowerIsBetter ? m.ci[0] > 0 : m.ci[1] < 0;
  const flag = better ? "  B better" : worse ? "  B worse" : "";
  const delta = (m.delta >= 0 ? "+" : "") + f(m.delta);
  console.log(`${m.metric.padEnd(27)}${f(m.a).padStart(8)}${f(m.b).padStart(8)}${delta.padStart(9)}   [${f(m.ci[0])}, ${f(m.ci[1])}]${flag}`);
}
console.log(`\nMcNemar (majority vote per brief): only A right ${c.mcnemar.onlyA}, only B right ${c.mcnemar.onlyB}, p=${c.mcnemar.p.toFixed(3)}`);
if (c.flips.length) {
  console.log("Briefs whose majority choice changed:");
  for (const x of c.flips) console.log(`  ${x.id}: expected ${x.expected}, A ${x.a}${x.a === x.expected ? " ✓" : ""}, B ${x.b}${x.b === x.expected ? " ✓" : ""}`);
}
