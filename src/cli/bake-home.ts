import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { bakeStories, HOME_BRIEFS_FILE, loadStoryPlan } from "../demo/home-stories.ts";
import { loadShootoutEvidence } from "../demo/shootout-evidence.ts";
import { createJevClient } from "../jev/client.ts";
import { withRetries } from "../jev/retry.ts";
import { createJevPicker } from "../judging/jev-picker.ts";
import { createJevRater } from "../judging/jev-rater.ts";
import { createJevLocator, JEV_LOCATE_RETRIES } from "../locating/locator.ts";
import { createDecisionRouter } from "../routing/router.ts";
import { DEFAULT_VARIANT, getVariant } from "../routing/variants.ts";
import { jevConfigFromEnv } from "./config.ts";

const jev = createJevClient(jevConfigFromEnv());
const shootout = await loadShootoutEvidence(join("runs", "shootout"), createJevPicker(jev), createJevRater(jev));
if (!shootout) {
  console.error("No picked shootout under runs/shootout. Run `npm run generate -- --shootout`, then `npm run pick-jev -- <dir>`.");
  process.exit(1);
}
await bakeStories(
  await loadStoryPlan(HOME_BRIEFS_FILE),
  shootout,
  { locator: createJevLocator(withRetries(jev, JEV_LOCATE_RETRIES)), router: createDecisionRouter(jev, getVariant(DEFAULT_VARIANT)), readImage: (path) => readFile(path) },
  (id, presence) => console.log(`  ${id}: subject ${Math.round(presence * 100)}% present`),
);
console.log(`Home stories in ${shootout.dir}`);
