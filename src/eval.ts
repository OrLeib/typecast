import { execSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { isBorderline, loadBriefs } from "./briefs.ts";
import { accuracy, brier, confidentMisses, ece, logLoss, percentile, reliabilityBins } from "./metrics.ts";
import { route } from "./router.ts";
import type { Result } from "./runs.ts";
import { VARIANTS } from "./variants.ts";

const PRICE_PER_M_INPUT = 0.042; // USD, Jev list price; output tokens are free

const { values: args } = parseArgs({
  options: {
    data: { type: "string", default: "data/dev.jsonl" },
    variant: { type: "string", default: "baseline" },
    repeats: { type: "string", default: "1" },
  },
});
const variant = VARIANTS[args.variant];
if (!variant) throw new Error(`Unknown variant "${args.variant}". Known: ${Object.keys(VARIANTS).join(", ")}`);
const repeats = Number(args.repeats);
if (!Number.isInteger(repeats) || repeats < 1) throw new Error(`--repeats must be a positive integer, got ${args.repeats}`);

const briefs = await loadBriefs(args.data);
const borderline = new Set(briefs.filter(isBorderline).map((b) => b.id));

const results: Result[] = [];
for (let repeat = 0; repeat < repeats; repeat++) {
  for (const b of briefs) {
    const r = await route(b.brief, variant);
    results.push({ id: b.id, repeat, expected: b.expected, choice: r.choice, confidence: r.confidence, probabilities: r.probabilities, latencyMs: r.latencyMs, inputTokens: r.inputTokens, model: r.model });
    process.stdout.write(r.choice === b.expected ? "." : "x");
  }
  console.log();
}

const latencies = results.map((r) => r.latencyMs);
const tokens = results.reduce((s, r) => s + r.inputTokens, 0);
const perRepeatAccuracy = Array.from({ length: repeats }, (_, i) => accuracy(results.filter((r) => r.repeat === i)));
const summary = {
  data: args.data,
  variant: args.variant,
  repeats,
  commit: git("rev-parse --short HEAD") + (git("status --porcelain") ? "-dirty" : ""),
  n: briefs.length,
  model: [...new Set(results.map((r) => r.model))].join(","),
  accuracy: accuracy(results),
  accuracyClear: accuracy(results.filter((r) => !borderline.has(r.id))),
  accuracyBorderline: accuracy(results.filter((r) => borderline.has(r.id))),
  perRepeatAccuracy,
  ece: ece(results),
  logLoss: logLoss(results),
  brier: brier(results),
  confidentMissesPerRepeat: confidentMisses(results) / repeats,
  latencyP50: percentile(latencies, 50),
  latencyP95: percentile(latencies, 95),
  costPer1000Usd: (tokens / results.length) * 1000 * (PRICE_PER_M_INPUT / 1e6),
  bins: reliabilityBins(results),
};

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
console.log(`${summary.data}  variant=${summary.variant}  n=${summary.n} x${repeats}  model=${summary.model}  commit=${summary.commit}`);
console.log(`accuracy ${pct(summary.accuracy)} (clear ${pct(summary.accuracyClear)}, borderline ${pct(summary.accuracyBorderline)})  per repeat ${perRepeatAccuracy.map(pct).join(" / ")}`);
console.log(`ECE ${summary.ece.toFixed(3)}  log-loss ${summary.logLoss.toFixed(3)}  Brier ${summary.brier.toFixed(3)}  confident misses (>=0.85) ${summary.confidentMissesPerRepeat.toFixed(1)} per repeat`);
console.log(`latency p50 ${Math.round(summary.latencyP50)}ms  p95 ${Math.round(summary.latencyP95)}ms   cost per 1,000 routes ~$${summary.costPer1000Usd.toFixed(4)}`);
for (const r of results.filter((r) => r.choice !== r.expected)) {
  const runnerUp = Object.entries(r.probabilities).filter(([k]) => k !== r.choice).sort(([, a], [, b]) => b - a)[0];
  console.log(`  miss ${r.id}#${r.repeat}: expected ${r.expected} (${(r.probabilities[r.expected] ?? 0).toFixed(2)}), got ${r.choice} (${r.confidence.toFixed(2)}), runner-up ${runnerUp?.[0]}`);
}

await mkdir("runs", { recursive: true });
const out = `runs/${new Date().toISOString().replace(/[:.]/g, "-")}-${args.variant}.json`;
await writeFile(out, JSON.stringify({ summary, results }, null, 2));
console.log(`saved ${out}`);

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}
