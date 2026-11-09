// The home page: one brief at a time through the three decisions, which model, which image, where in the frame. Everything
// is baked into the page, so it answers instantly and works with Jev down. Numbers stay on the results page.
import { PICK_THRESHOLD } from "../routing/recommendation.ts";
import { squareCrop } from "../locating/square-crop.ts";
import { FAVICON_LINK, REPO_URL } from "../shared/brand.ts";
import { escapeHtml } from "../shared/format.ts";
import type { HomeStory } from "./home-stories.ts";
import { frame, LIGHTBOX, LIGHTBOX_STYLE, modelName, shotCaption } from "./lightbox.ts";
import { BASE_STYLE, PAGE_PATHS, pageNav, WITH_MOTION } from "./page-style.ts";
import type { ShootoutShot } from "./shootout-evidence.ts";

const SITE_URL = "https://typecast-ai.vercel.app";
export const DESCRIPTION = "Typecast is a decision layer for AI image tools: give it a brief and it picks the model, picks the best image and finds the subject.";
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
  .chips { position: sticky; top: 0; z-index: 5; display: flex; gap: 8px; padding: 12px 8px; margin: 0 -8px 4px; background: var(--bg); overflow-x: auto; scrollbar-width: none; }
  .chips::-webkit-scrollbar { display: none; }
  .chips button { flex: none; padding: 7px 14px; border-radius: 999px; font-size: 14px; font-weight: 550; color: var(--text-2); background: transparent; transition: color .15s; }
  .chips button[aria-pressed="true"] { background: var(--text); border-color: var(--text); color: var(--bg); }
  .chips.sliding button { position: relative; }
  .chips.sliding button[aria-pressed="true"] { background: transparent; border-color: transparent; }
  .pill { position: absolute; left: 0; border-radius: 999px; background: var(--text); }
  article { animation: fade .25s ease; }
  .step { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 48px; align-items: start; margin: 0; padding: 44px 0; border-top: 1px solid var(--line); }
  .step:first-child { border-top: 0; padding-top: 20px; }
  h2 { margin: 0 0 12px; font-size: 26px; line-height: 1.2; letter-spacing: -0.02em; font-weight: 660; }
  .step p { margin: 0; color: var(--text-2); max-width: 44ch; text-wrap: pretty; }
  blockquote { margin: 0 0 22px; font-size: 18px; line-height: 1.45; text-wrap: pretty; }
  .choice { font-size: 30px; line-height: 1.15; font-weight: 680; letter-spacing: -0.02em; }
  .choice span { color: var(--muted); font-weight: 500; }
  .meter { position: relative; height: 6px; margin: 16px 0 10px; border-radius: 999px; background: var(--track); max-width: 320px; }
  .meter i { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: var(--accent); }
  .decision { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .decision.pick { color: var(--good-text); }
  .decision.compare { color: var(--warn-text); }
  .step .why { margin-top: 6px; font-size: 14px; }
  .more { display: inline-block; margin-top: 18px; font-size: 14px; font-weight: 550; color: var(--accent-text); text-decoration: none; }
  .more:hover { text-decoration: underline; }
  .shots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .shots.one { grid-template-columns: minmax(0, 1fr); max-width: 380px; justify-self: end; width: 100%; }
  figure { margin: 0; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  figcaption { display: flex; gap: 8px; align-items: center; justify-content: center; flex-wrap: wrap; min-height: 22px; font-size: 13px; color: var(--text-2); }
  code { font: 12.5px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--muted); }
  .tag { font-size: 12px; font-weight: 600; padding: 1px 8px; border: 1px solid var(--accent); border-radius: 999px; white-space: nowrap; color: var(--accent-text); }
  .tag.judge { background: var(--accent-soft); }
  .status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .step.wide { grid-template-columns: minmax(0, 1fr); gap: 24px; }
  .step.wide p { max-width: none; }
  .lineup { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
  .lineup .model { flex-basis: 100%; text-align: center; }
  .found { position: relative; aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: var(--surface-2); }
  .found img { position: absolute; display: block; width: 100%; }
  .found .box { position: absolute; border: 2px solid var(--accent); border-radius: 4px; box-shadow: 0 0 0 999px rgba(0, 0, 0, .35); }
  footer { display: flex; justify-content: space-between; align-items: center; gap: 12px 24px; flex-wrap: wrap; margin-top: 8px; padding: 28px 0 56px; border-top: 1px solid var(--line); font-size: 14px; }
  footer a:not(.more) { color: var(--muted); }
  ${WITH_MOTION} {
    .pill { transition: transform .35s var(--ease), width .35s var(--ease); }
    .armed .meter i { transform-origin: left; animation: fill .8s var(--ease) both; }
    .armed :is(.decision, .why) { animation: rise .4s var(--ease) .45s both; }
    .armed .shots.routed figure { animation: rise .5s var(--ease) calc(var(--i) * 90ms + .1s) both; }
    .armed .lineup figure { animation: rise .5s var(--ease) calc(var(--i) * 70ms) both; }
    .armed .lineup .tag { animation: land .45s var(--spring) .55s both; }
    .armed .lineup .best .frame { animation: ring .3s ease .55s both; }
    .armed .found .box { animation: land .5s var(--spring) .2s both; }
    .armed .found img.crop { transform-origin: 0 0; animation: zoom .9s cubic-bezier(.65, 0, .35, 1) .7s both; }
    /* Held on their first frame until the step is on screen, or they'd play out of sight. Important because the rules above set it too, through the shorthand. */
    .armed .step:not(.seen) * { animation-play-state: paused !important; }
    @keyframes fill { from { transform: scaleX(0); } }
    @keyframes rise { from { opacity: 0; transform: translateY(10px); } }
    @keyframes land { from { opacity: 0; transform: scale(1.25); } }
    @keyframes ring { from { outline-color: transparent; } }
    @keyframes zoom { from { transform: var(--whole); } }
  }
  @media (max-width: 760px) {
    h1 { margin-top: 28px; }
    .chips { margin-inline: -16px; padding-inline: 16px; }
    .chips button { min-height: 44px; }
    .more { padding-block: 11px; margin-top: 8px; }
    .step { grid-template-columns: minmax(0, 1fr); gap: 20px; padding: 32px 0; }
    .shots.one { max-width: none; }
    .lineup { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .lineup figure.best { order: -1; grid-column: 1 / -1; }
  }
`;

const SCRIPT = `
(function () {
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chips button"));
  var stories = Array.prototype.slice.call(document.querySelectorAll("article"));
  var bar = document.querySelector(".chips");
  var status = document.querySelector(".status");
  if (!chips.length) return;
  var pill = document.createElement("span");
  pill.className = "pill";
  function placePill() {
    var chip = bar.querySelector('[aria-pressed="true"]');
    pill.style.cssText = "top:" + chip.offsetTop + "px;height:" + chip.offsetHeight + "px;width:" + chip.offsetWidth + "px;transform:translateX(" + chip.offsetLeft + "px)";
  }
  // Placed before it joins the page, so it starts where it belongs instead of sliding in from the left.
  placePill();
  bar.prepend(pill);
  bar.classList.add("sliding");
  var onScreen = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      // A step taller than the window can never show enough of itself, so filling half the window counts too.
      if (entry.intersectionRatio < 0.4 && entry.intersectionRect.height < entry.rootBounds.height / 2) return;
      entry.target.classList.add("seen");
      onScreen.unobserve(entry.target);
    });
  }, { threshold: [0, 0.1, 0.2, 0.3, 0.4] });
  function watch(story) {
    story.querySelectorAll(".step").forEach(function (step) {
      step.classList.remove("seen");
      onScreen.observe(step);
    });
  }
  // A hidden story's lazy images would only start loading when it opens, and flash in, so load one as soon as it's likely.
  function prepare(i) {
    var story = stories[i];
    if (story) story.querySelectorAll("img").forEach(function (img) { img.loading = "eager"; });
  }
  chips.forEach(function (chip, i) {
    chip.addEventListener("pointerenter", function () { prepare(i); });
    chip.addEventListener("focus", function () { prepare(i); });
    chip.addEventListener("click", function () {
      chips.forEach(function (c, j) { c.setAttribute("aria-pressed", String(j === i)); });
      stories.forEach(function (s, j) { s.hidden = j !== i; });
      placePill();
      watch(stories[i]);
      status.textContent = "Showing " + chip.textContent;
      prepare(i + 1);
      var top = stories[i].getBoundingClientRect().top - bar.offsetHeight;
      if (top < 0) window.scrollBy({ top: top, behavior: "instant" });
    });
  });
  watch(stories[0]);
  window.addEventListener("resize", placePill);
  window.addEventListener("load", function () { prepare(1); });
})();
`;

const PERCENT = (x: number) => `${Math.round(x * 100)}%`;

/** A calibrated model is never certain, and "100% sure" beside a judge who disagrees reads as a claim it doesn't make. */
const sureness = (confidence: number) => (confidence > 0.99 ? "99%+" : PERCENT(confidence));

const imageOf = (generator: string) => `${modelName(generator)}'s image for this brief`;

/** With one image the model is already named beside it; with two, each needs its name. */
function routeShot(story: HomeStory, shot: ShootoutShot, named: boolean, index: number) {
  const caption = named ? `<figcaption><code>${escapeHtml(modelName(shot.generator))}</code></figcaption>` : "";
  return `<figure style="--i:${index}">${frame(shot, story.brief.shots.indexOf(shot), imageOf(shot.generator))}${caption}</figure>`;
}

function reasonLine({ explanation: { because, open } }: HomeStory) {
  if (open.length) return `<p class="why">Would settle it: ${open.map((reason) => escapeHtml(reason.label)).join(" or ")}</p>`;
  return because.length ? `<p class="why">Why: ${escapeHtml(because[0].label)}</p>` : "";
}

function modelStep(story: HomeStory) {
  const { brief, confidence, routed, second } = story;
  const confident = confidence >= PICK_THRESHOLD;
  const shots = [routed, confident ? undefined : second].filter((shot) => shot !== undefined);
  const name = modelName(brief.routedGenerator);
  const secondName = second && !confident ? ` <span>or</span> ${escapeHtml(modelName(second.generator))}` : "";
  return `<section class="step">
    <div>
      <h2>Which model?</h2>
      <blockquote>${escapeHtml(brief.brief)}</blockquote>
      <div class="choice">${escapeHtml(name)}${secondName}</div>
      <div class="meter"><i style="width:${PERCENT(confidence)}"></i></div>
      <div class="decision ${confident ? "pick" : "compare"}">${sureness(confidence)} sure it fits: ${confident ? "just use it" : "show the top two"}</div>
      ${reasonLine(story)}
      <a class="more" href="${PAGE_PATHS.route}">Try your own brief &rarr;</a>
    </div>
    <div class="shots routed${shots.length === 1 ? " one" : ""}">${shots.map((shot, i) => routeShot(story, shot, shots.length > 1, i)).join("")}</div>
  </section>`;
}

function lineupShot(story: HomeStory, shot: ShootoutShot, index: number, defaultGenerator: string) {
  const routed = shot.generator === story.brief.routedGenerator;
  const tags = [routed && `<span class="tag">Typecast's pick</span>`, shot.picked && `<span class="tag judge">Judge's pick</span>`].filter(Boolean).join("");
  const name = modelName(shot.generator);
  return `<figure class="${shot.picked ? "best" : ""}" style="--i:${index}">${frame(shot, index, imageOf(shot.generator), shotCaption(story.brief, shot, defaultGenerator))}<figcaption><code class="model">${escapeHtml(name)}</code>${tags}</figcaption></figure>`;
}

function imageStep(story: HomeStory, defaultGenerator: string) {
  const routedWon = story.best.generator === story.brief.routedGenerator;
  const line = routedWon ? "Five models, same brief. Seeing all five, the judge agreed with the pick." : `Five models, same brief. Seeing all five, the judge preferred ${escapeHtml(modelName(story.best.generator))}'s image.`;
  return `<section class="step wide">
    <div>
      <h2>Which image?</h2>
      <p>${line}</p>
      <a class="more" href="${PAGE_PATHS.results}">See every brief judged &rarr;</a>
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

/** `--whole` is the transform that shows the whole image in the same frame, which the crop zooms in from. */
function cropStyle({ left, top, size }: ReturnType<typeof cropInside>) {
  const whole = `translate(${percentOf(left, CROP_UNITS)}, ${percentOf(top, CROP_UNITS)}) scale(${size / CROP_UNITS})`;
  return `width:${percentOf(CROP_UNITS, size)};left:${percentOf(-left, size)};top:${percentOf(-top, size)};--whole:${whole}`;
}

function subjectStep(story: HomeStory) {
  const { box, best, target } = story;
  const crop = cropInside(box);
  const url = escapeHtml(best.url);
  return `<section class="step">
    <div>
      <h2>Where's the subject?</h2>
      <p>Told to find ${escapeHtml(target)}. The crop is ready to re-render in sharper detail.</p>
      <a class="more" href="${PAGE_PATHS.locate}">Try your own image &rarr;</a>
    </div>
    <div class="shots">
      <figure><div class="found"><img src="${url}" alt="The best image" loading="lazy"><div class="box" style="left:${percentOf(box.left, 1)};top:${percentOf(box.top, 1)};width:${percentOf(box.right - box.left, 1)};height:${percentOf(box.bottom - box.top, 1)}"></div></div><figcaption>Found</figcaption></figure>
      <figure><div class="found"><img class="crop" src="${url}" alt="The square crop around ${escapeHtml(target)}" loading="lazy" style="${cropStyle(crop)}"></div><figcaption>Cropped</figcaption></figure>
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
<script>document.documentElement.classList.add("armed")</script>
</head>
<body>
<div class="wrap">
<header class="top">
  ${pageNav()}
  <h1>Which model, which image, where in the frame</h1>
  <p class="lede">${DESCRIPTION}</p>
</header>
<main>
<div class="chips" role="group" aria-label="Choose a brief">${chips}</div>
<p class="status" role="status"></p>
${stories.map((story, i) => storyArticle(story, i, defaultGenerator)).join("\n")}
</main>
<footer>
  <a href="${REPO_URL}">Code and method</a>
</footer>
</div>
${LIGHTBOX}
<script>${SCRIPT}</script>
</body>
</html>
`;
}
