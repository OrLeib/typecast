// The home page: one brief at a time through the three decisions, which model, which image, where in the frame. Everything
// is baked into the page, so it answers instantly and works with Jev down. Numbers stay on the results page.
import { PICK_THRESHOLD } from "../routing/recommendation.ts";
import { squareCrop } from "../locating/square-crop.ts";
import { FAVICON_LINK, REPO_URL } from "../shared/brand.ts";
import { escapeHtml } from "../shared/format.ts";
import type { HomeStory } from "./home-stories.ts";
import { frame, LIGHTBOX, LIGHTBOX_STYLE, modelName, shotCaption } from "./lightbox.ts";
import { BASE_STYLE, PAGE_PATHS, pageNav } from "./page-style.ts";
import type { ShootoutShot } from "./shootout-evidence.ts";

const SITE_URL = "https://typecast-ai.vercel.app";
const DESCRIPTION = "Which model, which image, where in the frame: Typecast makes the three calls AI image tools leave to you.";
export const OG_IMAGE_PATH = "/og.jpg";
export const OG_SIZE = { width: 1200, height: 630 };

/** The share of the subject's longer edge added on every side of the crop. */
const CROP_PADDING = 0.3;
/** `squareCrop` rounds to whole units, so this is fine enough for a crop drawn with CSS. */
const CROP_UNITS = 1000;

const STYLE = `
  header.top { padding-bottom: 20px; }
  h1 { margin: 40px 0 10px; font-size: clamp(32px, 5vw, 48px); line-height: 1.06; letter-spacing: -0.03em; font-weight: 680; max-width: 18ch; }
  .lede { font-size: 18px; }
  .chips { position: sticky; top: 0; z-index: 5; display: flex; gap: 8px; padding: 12px 0; margin-bottom: 4px; background: var(--bg); overflow-x: auto; scrollbar-width: none; }
  .chips::-webkit-scrollbar { display: none; }
  .chips button { flex: none; padding: 7px 14px; border-radius: 999px; font-size: 14px; font-weight: 550; color: var(--text-2); background: transparent; transition: none; }
  .chips button[aria-pressed="true"] { background: var(--text); border-color: var(--text); color: var(--bg); }
  .step { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 48px; align-items: center; margin: 0; padding: 44px 0; border-top: 1px solid var(--line); }
  .step:first-child { border-top: 0; padding-top: 20px; }
  h2 { margin: 0 0 12px; font-size: 26px; line-height: 1.2; letter-spacing: -0.02em; font-weight: 660; }
  .step p { margin: 0; color: var(--text-2); max-width: 44ch; text-wrap: pretty; }
  blockquote { margin: 0 0 22px; font-size: 18px; line-height: 1.45; text-wrap: pretty; }
  .choice { font-size: 30px; line-height: 1.15; font-weight: 680; letter-spacing: -0.02em; }
  .choice span { color: var(--muted); font-weight: 500; }
  .meter { position: relative; height: 6px; margin: 16px 0 10px; border-radius: 999px; background: var(--track); max-width: 320px; }
  .meter i { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: var(--accent); }
  .meter b { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--muted); }
  .decision { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .decision.pick { color: var(--good-text); }
  .decision.compare { color: var(--warn-text); }
  .more { display: inline-block; margin-top: 18px; font-size: 14px; font-weight: 550; color: var(--accent-text); text-decoration: none; }
  .more:hover { text-decoration: underline; }
  .shots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .shots.one { grid-template-columns: minmax(0, 1fr); max-width: 380px; justify-self: end; width: 100%; }
  figure { margin: 0; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  figcaption { display: flex; gap: 8px; align-items: center; justify-content: center; flex-wrap: wrap; min-height: 22px; font-size: 13px; color: var(--text-2); }
  code { font: 12.5px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--muted); }
  .tag { font-size: 12px; font-weight: 600; padding: 1px 8px; border-radius: 999px; color: var(--accent-text); background: var(--accent-soft); }
  .step.wide { grid-template-columns: minmax(0, 1fr); gap: 24px; }
  .step.wide p { max-width: none; }
  .lineup { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
  .found { position: relative; aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: var(--surface-2); }
  .found img { position: absolute; display: block; width: 100%; }
  .found .box { position: absolute; border: 2px solid var(--accent); border-radius: 4px; box-shadow: 0 0 0 999px rgba(0, 0, 0, .35); }
  footer { display: flex; justify-content: space-between; align-items: center; gap: 12px 24px; flex-wrap: wrap; margin-top: 8px; padding: 28px 0 56px; border-top: 1px solid var(--line); font-size: 14px; }
  footer .more { margin: 0; font-size: 16px; }
  footer a:not(.more) { color: var(--muted); }
  @media (max-width: 760px) {
    h1 { margin-top: 28px; }
    .chips { margin-right: -16px; padding-right: 16px; }
    .step { grid-template-columns: minmax(0, 1fr); gap: 20px; padding: 32px 0; }
    .shots.one { max-width: none; }
    .lineup { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .lineup figure.best { order: -1; }
    .lineup figcaption .model { display: none; }
    .lineup figcaption { gap: 4px; flex-wrap: nowrap; }
    .lineup .tag { font-size: 11px; padding: 1px 6px; }
  }
`;

const SCRIPT = `
(function () {
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chips button"));
  var stories = Array.prototype.slice.call(document.querySelectorAll("article"));
  chips.forEach(function (chip, i) {
    chip.addEventListener("click", function () {
      chips.forEach(function (c, j) { c.setAttribute("aria-pressed", String(j === i)); });
      stories.forEach(function (s, j) { s.hidden = j !== i; });
    });
  });
  // Lazy images in a hidden story would only start loading when it opens, and flash in.
  window.addEventListener("load", function () {
    document.querySelectorAll("img[loading]").forEach(function (img) { img.loading = "eager"; });
  });
})();
`;

const PERCENT = (x: number) => `${Math.round(x * 100)}%`;

function routeShot(story: HomeStory, shot: ShootoutShot) {
  const index = story.brief.shots.indexOf(shot);
  return `<figure>${frame(shot, index, `${modelName(shot.generator)}'s image for this brief`)}<figcaption><code>${escapeHtml(modelName(shot.generator))}</code></figcaption></figure>`;
}

function modelStep(story: HomeStory) {
  const { brief, routed, second } = story;
  const confident = brief.confidence >= PICK_THRESHOLD;
  const shots = [routed, confident ? undefined : second].filter((shot) => shot !== undefined);
  const name = modelName(brief.routedGenerator);
  const secondName = second && !confident ? ` <span>or</span> ${escapeHtml(modelName(second.generator))}` : "";
  return `<section class="step">
    <div>
      <h2>Which model?</h2>
      <blockquote>${escapeHtml(brief.brief)}</blockquote>
      <div class="choice">${escapeHtml(name)}${secondName}</div>
      <div class="meter"><i style="width:${PERCENT(brief.confidence)}"></i><b style="left:${PERCENT(PICK_THRESHOLD)}"></b></div>
      <div class="decision ${confident ? "pick" : "compare"}">${PERCENT(brief.confidence)} sure: ${confident ? "just use it" : "show the top two"}</div>
      <a class="more" href="${PAGE_PATHS.route}">Try your own brief &rarr;</a>
    </div>
    <div class="shots${shots.length === 1 ? " one" : ""}">${shots.map((shot) => routeShot(story, shot)).join("")}</div>
  </section>`;
}

function lineupShot(story: HomeStory, shot: ShootoutShot, index: number, defaultGenerator: string) {
  const routed = shot.generator === story.brief.routedGenerator;
  const tags = [shot.picked && `<span class="tag">Best</span>`, routed && `<span class="tag">Chosen</span>`].filter(Boolean).join("");
  const name = modelName(shot.generator);
  return `<figure class="${shot.picked ? "best" : ""}">${frame(shot, index, name, shotCaption(story.brief, shot, defaultGenerator))}<figcaption><code class="model">${escapeHtml(name)}</code>${tags}</figcaption></figure>`;
}

function imageStep(story: HomeStory, defaultGenerator: string) {
  const routedWon = story.best.generator === story.brief.routedGenerator;
  const line = routedWon ? "Five models, same brief. The chosen model also made the best image." : `Five models, same brief. This time the best image came from ${escapeHtml(modelName(story.best.generator))}, not the chosen model.`;
  return `<section class="step wide">
    <div>
      <h2>Which image?</h2>
      <p>${line}</p>
    </div>
    <div class="lineup">${story.brief.shots.map((shot, i) => lineupShot(story, shot, i, defaultGenerator)).join("")}</div>
  </section>`;
}

const percentOf = (part: number, whole: number) => `${((part / whole) * 100).toFixed(2)}%`;

/** The padded square, moved and shrunk to stay inside the image: here it is a picture, not the input to a detail pass. */
function cropInside(box: HomeStory["box"]) {
  // Shootout images are square, so a square of any size stands in for the image.
  const crop = squareCrop(box, { width: CROP_UNITS, height: CROP_UNITS }, CROP_PADDING);
  const size = Math.min(crop.size, CROP_UNITS);
  const inside = (start: number) => Math.min(Math.max(start, 0), CROP_UNITS - size);
  return { left: inside(crop.left), top: inside(crop.top), size };
}

function subjectStep(story: HomeStory) {
  const { box, best, target } = story;
  const crop = cropInside(box);
  const url = escapeHtml(best.url);
  return `<section class="step">
    <div>
      <h2>Where's the subject?</h2>
      <p>Asked for ${escapeHtml(target)}. A square crop, ready for a detail pass.</p>
      <a class="more" href="${PAGE_PATHS.locate}">Try your own image &rarr;</a>
    </div>
    <div class="shots">
      <figure><div class="found"><img src="${url}" alt="The best image" loading="lazy"><div class="box" style="left:${percentOf(box.left, 1)};top:${percentOf(box.top, 1)};width:${percentOf(box.right - box.left, 1)};height:${percentOf(box.bottom - box.top, 1)}"></div></div><figcaption>Found</figcaption></figure>
      <figure><div class="found"><img src="${url}" alt="The square crop around ${escapeHtml(target)}" loading="lazy" style="width:${percentOf(CROP_UNITS, crop.size)};left:${percentOf(-crop.left, crop.size)};top:${percentOf(-crop.top, crop.size)}"></div><figcaption>Cropped</figcaption></figure>
    </div>
  </section>`;
}

const storyArticle = (story: HomeStory, index: number, defaultGenerator: string) =>
  `<article${index ? " hidden" : ""}>${modelStep(story)}${imageStep(story, defaultGenerator)}${subjectStep(story)}</article>`;

export function homePage({ stories, defaultGenerator }: { stories: HomeStory[]; defaultGenerator: string }): string {
  const chips = stories.map((story, i) => `<button type="button" aria-pressed="${i === 0}">${escapeHtml(story.label)}</button>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Typecast</title>
${FAVICON_LINK}
<meta name="description" content="${DESCRIPTION}">
<meta property="og:type" content="website">
<meta property="og:title" content="Typecast">
<meta property="og:description" content="${DESCRIPTION}">
<meta property="og:url" content="${SITE_URL}">
<meta property="og:image" content="${SITE_URL}${OG_IMAGE_PATH}">
<meta property="og:image:width" content="${OG_SIZE.width}">
<meta property="og:image:height" content="${OG_SIZE.height}">
<meta name="twitter:card" content="summary_large_image">
<style>${BASE_STYLE}${LIGHTBOX_STYLE}${STYLE}</style>
</head>
<body>
<div class="wrap">
<header class="top">
  ${pageNav()}
  <h1>Which model, which image, where in the frame</h1>
  <p class="lede">Typecast makes the three calls AI image tools leave to you.</p>
</header>
<main>
<div class="chips" role="group" aria-label="Choose a brief">${chips}</div>
${stories.map((story, i) => storyArticle(story, i, defaultGenerator)).join("\n")}
</main>
<footer>
  <a class="more" href="${PAGE_PATHS.results}">See the numbers &rarr;</a>
  <a href="${REPO_URL}">Code and method</a>
</footer>
</div>
${LIGHTBOX}
<script>${SCRIPT}</script>
</body>
</html>
`;
}
