import type { RunMeta } from "../evaluation/summary.ts";
import { verdict, type Comparison } from "./compare.ts";

const fixed = (x: number) => x.toFixed(3);
const signed = (x: number) => (x >= 0 ? "+" : "") + fixed(x);
const describeRun = (s: RunMeta & { model: string }) => `${s.variant} x${s.repeats} @${s.commit} (${s.model})`;

export function formatComparison(c: Comparison, a: RunMeta & { model: string }, b: RunMeta & { model: string }): string[] {
  const lines = [
    `${a.data}, n=${c.n}`,
    `A: ${describeRun(a)}`,
    `B: ${describeRun(b)}`,
    "",
    `${"metric".padEnd(27)}${"A".padStart(8)}${"B".padStart(8)}${"B-A".padStart(9)}   95% CI`,
  ];
  for (const d of c.metrics) {
    const v = verdict(d);
    const flag = v === "unclear" ? "" : `  B ${v}`;
    lines.push(`${d.metric.padEnd(27)}${fixed(d.a).padStart(8)}${fixed(d.b).padStart(8)}${signed(d.delta).padStart(9)}   [${fixed(d.ci[0])}, ${fixed(d.ci[1])}]${flag}`);
  }
  lines.push("", `McNemar (majority vote per brief): only A right ${c.mcnemar.onlyA}, only B right ${c.mcnemar.onlyB}, p=${c.mcnemar.p.toFixed(3)}`);
  if (c.flips.length) {
    lines.push("Briefs whose majority choice changed:");
    const mark = (choice: string, expected: string) => (choice === expected ? " ✓" : "");
    for (const f of c.flips) lines.push(`  ${f.id}: expected ${f.expected}, A ${f.a}${mark(f.a, f.expected)}, B ${f.b}${mark(f.b, f.expected)}`);
  }
  return lines;
}
