import { createJevClient } from "../jev/client.ts";
import { createDecisionRouter, rankOptions } from "../routing/router.ts";
import { DEFAULT_VARIANT, getVariant } from "../routing/variants.ts";
import { jevConfigFromEnv } from "./config.ts";

const brief = process.argv.slice(2).join(" ").trim();
if (!brief) {
  console.error('Usage: npm run route -- "<creative brief>"');
  process.exit(1);
}

const router = createDecisionRouter(createJevClient(jevConfigFromEnv()), getVariant(DEFAULT_VARIANT));
const r = await router.route(brief);
console.log(`→ ${r.choice}  (confidence ${r.confidence.toFixed(2)}, ${Math.round(r.latencyMs)}ms, ${r.model})`);
for (const [option, p] of rankOptions(r.probabilities)) console.log(`  ${option.padEnd(14)} ${p.toFixed(3)}`);
