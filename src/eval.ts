import { readFile, writeFile, mkdir } from "node:fs/promises";
import { route } from "./router.ts";
import { accuracy, ece, percentile, reliabilityBins, type Prediction } from "./metrics.ts";

const PRICE_PER_M_INPUT = 0.042; // USD, Jev list price; output tokens are free

const file = process.argv[2] ?? "data/briefs.jsonl";
const rows = (await readFile(file, "utf8"))
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as { id: string; brief: string; expected: string; note?: string });

const results: (Prediction & { id: string; probabilities: Record<string, number>; latencyMs: number; inputTokens: number; model: string })[] = [];
for (const row of rows) {
  const r = await route(row.brief);
  results.push({ id: row.id, expected: row.expected, choice: r.choice, confidence: r.confidence, probabilities: r.probabilities, latencyMs: r.latencyMs, inputTokens: r.inputTokens, model: r.model });
  process.stdout.write(r.choice === row.expected ? "." : "x");
}
console.log();

const latencies = results.map((r) => r.latencyMs);
const tokens = results.reduce((s, r) => s + r.inputTokens, 0);
const summary = {
  n: results.length,
  model: [...new Set(results.map((r) => r.model))].join(","),
  accuracy: accuracy(results),
  ece: ece(results),
  latencyP50: percentile(latencies, 50),
  latencyP95: percentile(latencies, 95),
  costPer1000Usd: results.length ? (tokens / results.length) * 1000 * (PRICE_PER_M_INPUT / 1e6) : 0,
  bins: reliabilityBins(results),
};

console.log(`n=${summary.n}  model=${summary.model}`);
console.log(`accuracy ${(summary.accuracy * 100).toFixed(1)}%   ECE ${summary.ece.toFixed(3)}`);
console.log(`latency p50 ${Math.round(summary.latencyP50)}ms  p95 ${Math.round(summary.latencyP95)}ms`);
console.log(`cost per 1,000 routes ~$${summary.costPer1000Usd.toFixed(4)}`);
for (const r of results.filter((r) => r.choice !== r.expected)) {
  console.log(`  miss ${r.id}: expected ${r.expected}, got ${r.choice} (${r.confidence.toFixed(2)})`);
}

await mkdir("runs", { recursive: true });
const out = `runs/${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
await writeFile(out, JSON.stringify({ summary, results }, null, 2));
console.log(`saved ${out}`);
