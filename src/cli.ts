import { route } from "./router.ts";

const brief = process.argv.slice(2).join(" ").trim();
if (!brief) {
  console.error('Usage: npm run route -- "<creative brief>"');
  process.exit(1);
}

const r = await route(brief);
const ranked = Object.entries(r.probabilities).sort(([, a], [, b]) => b - a);
console.log(`→ ${r.choice}  (confidence ${r.confidence.toFixed(2)}, ${Math.round(r.latencyMs)}ms, ${r.model ?? "model?"})`);
for (const [option, p] of ranked) console.log(`  ${option.padEnd(14)} ${p.toFixed(3)}`);
