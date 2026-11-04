// The briefs the home page walks through: `data/home-briefs.json` chooses them and names each subject, and baking asks Jev
// where that subject is in the brief's best image, so the page answers instantly, for free, and with Jev down.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Location, Locator } from "../locating/locator.ts";
import { explain, type Explanation } from "../routing/reasons.ts";
import { recommend } from "../routing/recommendation.ts";
import type { Router } from "../routing/router.ts";
import { readTextIfAny } from "../shared/files.ts";
import { expectArray, expectRecord, expectString, withSource } from "../shared/validate.ts";
import type { LoadedShootout, ShootoutBrief, ShootoutShot } from "./shootout-evidence.ts";

type StoryPlan = { id: string; label: string; target: string };

/** What baking kept for one brief. `generator` and `target` say what the box answers, so a changed pick is asked again. */
type StoryAnswer = { generator: string; target: string; box: Location["box"]; confidence: number; explanation: Explanation; runnerUp?: string };

export type HomeStory = {
  brief: ShootoutBrief;
  label: string;
  target: string;
  box: Location["box"];
  best: ShootoutShot;
  confidence: number;
  explanation: Explanation;
  routed?: ShootoutShot;
  /** Set when routing was unsure: the runner-up's image, shown beside the routed one. */
  second?: ShootoutShot;
};

export const HOME_BRIEFS_FILE = join("data", "home-briefs.json");
const ANSWERS_FILE = "home-stories.json";

export async function loadStoryPlan(file: string): Promise<StoryPlan[]> {
  const text = await readFile(file, "utf8");
  return withSource(`${file} is not a list of home briefs`, () =>
    expectArray(JSON.parse(text), "briefs").map((raw, i) => {
      const entry = expectRecord(raw, `briefs[${i}]`);
      return { id: expectString(entry.id, `briefs[${i}].id`), label: expectString(entry.label, `briefs[${i}].label`), target: expectString(entry.target, `briefs[${i}].target`) };
    }),
  );
}

const loadAnswers = async (dir: string) => JSON.parse((await readTextIfAny(join(dir, ANSWERS_FILE))) || "{}") as Record<string, StoryAnswer>;

const bestShot = (brief: ShootoutBrief) => brief.shots.find((shot) => shot.picked);

export type BakeDeps = { locator: Pick<Locator, "locate">; router: Pick<Router, "route">; readImage: (path: string) => Promise<Buffer> };

/** Asks only for what changed since the last bake, saving after each brief so an interrupted run resumes. */
export async function bakeStories(plan: StoryPlan[], { dir, evidence, files }: Pick<LoadedShootout, "dir" | "evidence" | "files">, deps: BakeDeps, onBaked?: (id: string, presence: number) => void) {
  const answers = await loadAnswers(dir);
  for (const { id, target } of plan) {
    const brief = evidence.briefs.find((b) => b.id === id);
    if (!brief) throw new Error(`no picked shootout brief ${id}`);
    const best = bestShot(brief);
    const image = best && files.get(best.url);
    if (!best || !image) throw new Error(`brief ${id} has no best image`);
    if (answers[id]?.target === target && answers[id].generator === best.generator) continue;
    const { box, presence } = await deps.locator.locate(await deps.readImage(image), target);
    answers[id] = { generator: best.generator, target, box, ...(await routeAgain(brief, deps.router)) };
    await writeFile(join(dir, ANSWERS_FILE), JSON.stringify(answers, null, 2));
    onBaked?.(id, presence);
  }
}

/** The manifest keeps only the routed choice, so each brief is asked again for its reasons and its top two. Another choice wouldn't match the images. */
async function routeAgain(brief: ShootoutBrief, router: Pick<Router, "route">) {
  const route = await router.route(brief.brief);
  if (route.choice !== brief.routed) throw new Error(`brief ${brief.id} now routes to ${route.choice}, not ${brief.routed}`);
  const recommendation = recommend(route);
  return { confidence: route.confidence, explanation: explain(route, recommendation), runnerUp: recommendation.mode === "compare" ? recommendation.shortlist[1] : undefined };
}

/** The plan's briefs with their baked answers, in the plan's order. A brief without a current answer is left out. */
export function toStories(plan: StoryPlan[], evidence: LoadedShootout["evidence"], answers: Record<string, StoryAnswer>): HomeStory[] {
  return plan.flatMap(({ id, label, target }): HomeStory[] => {
    const brief = evidence.briefs.find((b) => b.id === id);
    const best = brief && bestShot(brief);
    const answer = answers[id];
    if (!brief || !best || answer?.target !== target || answer.generator !== best.generator) return [];
    const shotOf = (generator?: string) => brief.shots.find((shot) => shot.generator === generator);
    return [{ brief, label, target, box: answer.box, best, confidence: answer.confidence, explanation: answer.explanation, routed: shotOf(brief.routedGenerator), second: shotOf(evidence.lineup[answer.runnerUp ?? ""]) }];
  });
}

export async function loadHomeStories(shootout: Pick<LoadedShootout, "dir" | "evidence"> | undefined, planFile = HOME_BRIEFS_FILE): Promise<HomeStory[]> {
  return shootout ? toStories(await loadStoryPlan(planFile), shootout.evidence, await loadAnswers(shootout.dir)) : [];
}
