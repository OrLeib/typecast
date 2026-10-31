import type { RunMeta } from "../evaluation/summary.ts";
import { verdict, type Comparison } from "./compare.ts";

const COLUMN_GAP = 2;
/** Fits a 3-decimal value like "12.345" plus a gap. */
const VALUE_WIDTH = 8;
/** One wider than a value, for the sign. */
const DELTA_WIDTH = VALUE_WIDTH + 1;

const fixed = (x: number) => (Number.isNaN(x) ? "n/a" : x.toFixed(3));
const signed = (x: number) => (x >= 0 ? "+" : "") + fixed(x);
const describeRun = (s: RunMeta & { model: string }) => `${s.variant} x${s.repeats} @${s.commit} (${s.model})`;

export function formatComparison(c: Comparison, a: RunMeta & { model: string }, b: RunMeta & { model: string }): string[] {
  const labelWidth = Math.max("metric".length, ...c.metrics.map((d) => d.metric.length)) + COLUMN_GAP;
  const lines = [
    `${a.data}, n=${c.n}`,
    `A: ${describeRun(a)}`,
    `B: ${describeRun(b)}`,
    "",
    `${"metric".padEnd(labelWidth)}${"A".padStart(VALUE_WIDTH)}${"B".padStart(VALUE_WIDTH)}${"B-A".padStart(DELTA_WIDTH)}   95% CI`,
  ];
  for (const d of c.metrics) {
    const v = verdict(d);
    const flag = v === "unclear" ? "" : `  B ${v}`;
    lines.push(`${d.metric.padEnd(labelWidth)}${fixed(d.a).padStart(VALUE_WIDTH)}${fixed(d.b).padStart(VALUE_WIDTH)}${signed(d.delta).padStart(DELTA_WIDTH)}   [${fixed(d.ci[0])}, ${fixed(d.ci[1])}]${flag}`);
  }
  lines.push("", `McNemar (majority vote per brief): only A right ${c.mcnemar.onlyA}, only B right ${c.mcnemar.onlyB}, p=${c.mcnemar.p.toFixed(3)}`);
  if (c.flips.length) {
    lines.push("Briefs whose majority choice changed:");
    const show = (choice: string | undefined, expected: string) => (choice === undefined ? "no majority" : choice === expected ? `${choice} ✓` : choice);
    for (const f of c.flips) lines.push(`  ${f.id}: expected ${f.expected}, A ${show(f.a, f.expected)}, B ${show(f.b, f.expected)}`);
  }
  return lines;
}
