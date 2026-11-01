import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadShootout } from "../generation/manifest.ts";
import { JEV_INPUT_PRICE_PER_MILLION } from "../jev/client.ts";
import { createJevPicker } from "../judging/jev-picker.ts";
import { PICK_SHEET_FILE, renderPickSheet } from "../judging/pick-sheet.ts";
import { summarizePicks } from "../judging/pick-summary.ts";
import { currentPicks, loadPicks, pickRun, PICKS_FILE } from "../judging/picks.ts";
import { formatPickSummary } from "../judging/report.ts";
import { inputCostUsd } from "../shared/cost.ts";
import { percent } from "../shared/format.ts";
import { jevImageClientFromEnv, runDirArg } from "./config.ts";

const dir = runDirArg("npm run pick-jev -- <runs/shootout/... dir>");

const manifest = await loadShootout(dir);
const picker = createJevPicker(jevImageClientFromEnv());
const inputTokens = await pickRun(picker, dir, manifest, {
  onPicked: (item, pick) =>
    console.log(`  ${item.id.padEnd(5)} ${item.route.choice.padEnd(13)} best ${pick.best.padEnd(24)} ${percent(pick.probabilities[pick.best], 0).padStart(4)}  agreement ${percent(pick.agreement, 0)}  (${pick.model})`),
});
console.log(`spent ${inputTokens} input tokens ($${inputCostUsd(inputTokens, JEV_INPUT_PRICE_PER_MILLION).toFixed(4)})`);

const picks = currentPicks(await loadPicks(join(dir, PICKS_FILE)), picker);
console.log(formatPickSummary(summarizePicks(manifest, picks), manifest.meta, picker.id).join("\n"));
await writeFile(join(dir, PICK_SHEET_FILE), renderPickSheet(manifest, picks, picker.id));
console.log(`contact sheet: ${join(dir, PICK_SHEET_FILE)}`);
