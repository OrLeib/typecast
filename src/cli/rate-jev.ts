import { join } from "node:path";
import { loadShootout } from "../generation/manifest.ts";
import { JEV_INPUT_PRICE_PER_MILLION } from "../jev/client.ts";
import { createJevPicker } from "../judging/jev-picker.ts";
import { createJevRater } from "../judging/jev-rater.ts";
import { currentPicks, loadPicks, PICKS_FILE } from "../judging/picks.ts";
import { currentRatings, loadRatings, rateRun, RATINGS_FILE, summarizeRatings } from "../judging/ratings.ts";
import { inputCostUsd } from "../shared/cost.ts";
import { jevImageClientFromEnv, runDirArg } from "./config.ts";

const dir = runDirArg("npm run rate-jev -- <runs/shootout/... dir>");

const manifest = await loadShootout(dir);
const client = jevImageClientFromEnv();
const rater = createJevRater(client);
const inputTokens = await rateRun(rater, dir, manifest, {
  onRated: (item, rating) => {
    const scores = Object.entries(rating.scores).map(([criterion, score]) => `${criterion} ${Math.round(score * 100)}`).join("  ");
    console.log(`  ${item.id.padEnd(5)} ${rating.generator.padEnd(24)} ${String(Math.round(rating.total * 100)).padStart(3)}  ${scores}`);
  },
});
console.log(`spent ${inputTokens} input tokens ($${inputCostUsd(inputTokens, JEV_INPUT_PRICE_PER_MILLION).toFixed(4)})`);

const ratings = currentRatings(await loadRatings(join(dir, RATINGS_FILE)), rater);
const picks = currentPicks(await loadPicks(join(dir, PICKS_FILE)), createJevPicker(client));
const { briefs, topWas, agreesWithPick } = summarizeRatings(manifest, ratings, picks);
console.log(`of ${briefs} briefs, the highest overall score went to the routed model ${topWas.routed} times and the default ${topWas.default}; it matched the pick ${agreesWithPick} times`);
