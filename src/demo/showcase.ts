// A one-page static showcase to send someone who won't run the demo: the routing claim, the held-out numbers behind
// it, and every brief of the latest judged shootout with the routed and default images side by side.
import { escapeHtml } from "../shared/format.ts";
import type { Evidence } from "./evidence.ts";
import type { ShootoutBrief, ShootoutEvidence, ShootoutShot } from "./shootout-evidence.ts";

export type ShowcaseInput = {
  /** Runs on brief sets that were never tuned against, so their numbers are the honest ones. */
  heldOut: Evidence[];
  shootout: ShootoutEvidence;
  pickThreshold: number;
  repoUrl: string;
  /** Links to the site's live demo pages, beside the brand. */
  links: string;
  /** Where the live routing demo lives, for the call to action. */
  tryUrl: string;
};

const STYLE = `
  :root {
    color-scheme: light;
    --bg: #f6f5f2; --surface: #ffffff; --frame: #ecebe6; --line: #e3e2dc;
    --text: #111110; --text-2: #4f4e4a; --muted: #75746e;
    --accent: #2a62c4; --accent-soft: #dce8fb; --accent-text: #1d4c9e;
    --pick-bg: #e3f4e3; --pick-text: #11621b; --compare-bg: #fdf1d6; --compare-text: #7a4f00;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --bg: #121211; --surface: #1b1b1a; --frame: #252523; --line: #2f2f2c;
      --text: #f0efec; --text-2: #c3c2b9; --muted: #8f8e87;
      --accent: #6ea0ff; --accent-soft: #1c3557; --accent-text: #a9cdf7;
      --pick-bg: #16301a; --pick-text: #6fd56f; --compare-bg: #3a2e12; --compare-text: #fbc756;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --bg: #121211; --surface: #1b1b1a; --frame: #252523; --line: #2f2f2c;
    --text: #f0efec; --text-2: #c3c2b9; --muted: #8f8e87;
    --accent: #6ea0ff; --accent-soft: #1c3557; --accent-text: #a9cdf7;
    --pick-bg: #16301a; --pick-text: #6fd56f; --compare-bg: #3a2e12; --compare-text: #fbc756;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--text); }
  body { font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }
  header { padding: 56px 0 8px; }
  .topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .pages { display: inline-flex; padding: 3px; background: var(--frame); border: 1px solid var(--line); border-radius: 10px; gap: 2px; }
  .pages a { padding: 5px 12px; font-size: 13px; font-weight: 500; color: var(--text-2); text-decoration: none; border-radius: 7px; }
  .pages a:hover { color: var(--text); }
  .pages a[aria-current="page"] { background: var(--surface); color: var(--text); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
  .try { display: inline-block; margin-top: 22px; padding: 10px 18px; border-radius: 10px; background: var(--text); color: var(--bg); font-weight: 600; text-decoration: none; }
  .try:hover { opacity: .88; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 650; font-size: 16px; }
  .brand i { width: 22px; height: 22px; border-radius: 6px; background: var(--text); color: var(--bg); display: grid; place-items: center; font: 700 13px/1 inherit; font-style: normal; }
  h1 { margin: 28px 0 14px; font-size: clamp(30px, 5vw, 46px); line-height: 1.08; letter-spacing: -0.03em; font-weight: 680; max-width: 20ch; text-wrap: balance; }
  .lede { margin: 0; font-size: 18px; color: var(--text-2); max-width: 60ch; text-wrap: pretty; }
  section { margin-top: 56px; }
  h2 { margin: 0 0 6px; font-size: 22px; letter-spacing: -0.015em; font-weight: 650; }
  .sub { margin: 0 0 20px; color: var(--text-2); max-width: 70ch; text-wrap: pretty; }
  .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .stat { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 6px; }
  .stat b { font-size: 30px; font-weight: 680; letter-spacing: -0.025em; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .stat span { font-size: 14px; color: var(--text-2); line-height: 1.4; }
  .note { margin: 14px 0 0; font-size: 13px; color: var(--muted); max-width: 80ch; }
  .briefs { display: flex; flex-direction: column; gap: 20px; }
  article { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 22px; }
  .brief-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px 24px; flex-wrap: wrap; margin-bottom: 18px; }
  blockquote { margin: 0; font-size: 18px; line-height: 1.45; max-width: 58ch; text-wrap: pretty; }
  .chip { flex: none; display: inline-flex; gap: 6px; align-items: center; font-size: 13px; font-weight: 600; padding: 4px 11px; border-radius: 999px; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .chip.pick { background: var(--pick-bg); color: var(--pick-text); }
  .chip.compare { background: var(--compare-bg); color: var(--compare-text); }
  .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  figure { margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .frame { aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: var(--frame); outline: 2.5px solid transparent; outline-offset: 3px; }
  .best .frame { outline-color: var(--accent); }
  .frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
  button.frame { display: block; width: 100%; padding: 0; border: 0; font: inherit; color: inherit; cursor: zoom-in; }
  button.frame:focus-visible { outline-color: var(--accent); }
  button.frame img { transition: transform .25s ease; }
  button.frame:hover img { transform: scale(1.03); }
  figcaption { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 14px; color: var(--text-2); }
  figcaption b { color: var(--text); font-weight: 600; }
  code { font: 12.5px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--muted); }
  .tag { font-size: 12px; font-weight: 600; padding: 1px 8px; border-radius: 999px; color: var(--accent-text); background: var(--accent-soft); }
  .verdict { margin: 16px 0 0; padding: 10px 14px; border-radius: 10px; font-size: 14px; }
  .verdict.hit { background: var(--pick-bg); color: var(--pick-text); }
  .verdict.miss { background: var(--compare-bg); color: var(--compare-text); }
  .lineup { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); display: grid; grid-template-columns: auto repeat(5, minmax(0, 110px)); align-items: center; gap: 12px; }
  .lineup p { margin: 0; font-size: 13px; color: var(--muted); max-width: 24ch; }
  .lineup figure { gap: 4px; }
  .lineup .frame { border-radius: 6px; outline-width: 2px; outline-offset: 2px; }
  .lineup figcaption { font-size: 12px; justify-content: center; }
  .lineup code { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  footer { margin: 64px 0 56px; padding-top: 20px; border-top: 1px solid var(--line); color: var(--muted); font-size: 14px; }
  footer p { margin: 0 0 8px; max-width: 80ch; }
  a { color: var(--accent-text); }
  #lightbox { padding: 0; border: 0; margin: 0; width: 100vw; height: 100dvh; max-width: none; max-height: none; background: transparent; color: #f0efec; }
  #lightbox::backdrop { background: rgba(10, 10, 9, .96); backdrop-filter: blur(8px); }
  .lb-stage { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 56px 72px 24px; }
  .lb-stage img { max-width: 100%; max-height: calc(100dvh - 170px); aspect-ratio: 1; object-fit: contain; border-radius: 10px; background: #252523; }
  .lb-cap { margin: 0; text-align: center; max-width: 70ch; }
  .lb-cap b { display: block; font-size: 16px; font-weight: 600; }
  .lb-cap span { display: block; font-size: 14px; color: #a8a79f; margin-top: 2px; }
  #lightbox button { position: absolute; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 999px; border: 0; background: rgba(255, 255, 255, .1); color: inherit; font: 26px/1 inherit; cursor: pointer; }
  #lightbox button:hover { background: rgba(255, 255, 255, .2); }
  #lightbox button:focus-visible { outline: 2px solid #6ea0ff; outline-offset: 2px; }
  .lb-close { top: 14px; right: 14px; }
  .lb-prev { left: 16px; top: 50%; transform: translateY(-50%); }
  .lb-next { right: 16px; top: 50%; transform: translateY(-50%); }
  @media (max-width: 760px) {
    .wrap { padding: 0 16px; }
    header { padding-top: 36px; }
    .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    article { padding: 16px; }
    .pair { gap: 10px; }
    .lineup { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .lineup p { grid-column: 1 / -1; max-width: none; }
    .lb-stage { padding: 64px 12px 24px; }
    .lb-prev, .lb-next { top: auto !important; bottom: 18px; transform: none !important; }
  }
`;

// Steps through one brief's lineup: every clickable image names its place in it, and the lineup's buttons carry the captions.
// No template literals, so this stays a plain string inside the page template.
const LIGHTBOX_SCRIPT = `
(function () {
  var box = document.getElementById("lightbox");
  var img = box.querySelector(".lb-stage img");
  var title = box.querySelector(".lb-cap b");
  var brief = box.querySelector(".lb-cap span");
  var shots = [];
  var at = 0;
  function show(i) {
    at = (i + shots.length) % shots.length;
    var shot = shots[at];
    img.src = shot.querySelector("img").src;
    img.alt = shot.dataset.caption;
    title.textContent = shot.dataset.caption + " · " + (at + 1) + " of " + shots.length;
  }
  document.addEventListener("click", function (e) {
    var button = e.target.closest("button.frame");
    if (!button) return;
    var card = button.closest("article");
    shots = Array.prototype.slice.call(card.querySelectorAll(".lineup .frame"));
    brief.textContent = card.querySelector("blockquote").textContent;
    show(Number(button.dataset.shot));
    box.showModal();
  });
  box.querySelector(".lb-prev").addEventListener("click", function () { show(at - 1); });
  box.querySelector(".lb-next").addEventListener("click", function () { show(at + 1); });
  box.querySelector(".lb-close").addEventListener("click", function () { box.close(); });
  box.addEventListener("click", function (e) { if (e.target === box || e.target.classList.contains("lb-stage")) box.close(); });
  box.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") show(at - 1);
    if (e.key === "ArrowRight") show(at + 1);
  });
  var startX = null;
  box.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
  box.addEventListener("touchend", function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) show(dx < 0 ? at + 1 : at - 1);
    startX = null;
  });
})();
`;

const PERCENT = (x: number) => `${Math.round(x * 100)}%`;

/** "mflux:z-image-turbo@q8" reads as "z-image-turbo": the runner and quantization are noise to a reader. */
export const modelName = (generator: string) => generator.replace(/^[^:]+:/, "").replace(/@.*$/, "");

const categoryName = (category: string) => category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, " ");

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const mean = (values: number[]) => sum(values) / values.length;

function heldOutStats(heldOut: Evidence[]) {
  const total = (key: keyof Evidence["outcomes"]) => sum(heldOut.map((e) => e.outcomes[key]));
  return {
    briefs: sum(heldOut.map((e) => e.n)),
    routes: sum(heldOut.map((e) => e.n * e.repeats)),
    picked: total("picked"),
    pickedRight: total("pickedRight"),
    compared: total("compared"),
    comparedInShortlist: total("comparedInShortlist"),
    latencyMs: Math.round(mean(heldOut.map((e) => e.latencyP50))),
    costPer1000Usd: mean(heldOut.map((e) => e.costPer1000Usd)),
  };
}

const stat = (value: string, label: string) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`;

function routingSection(heldOut: Evidence[], pickThreshold: number) {
  const s = heldOutStats(heldOut);
  return `<section>
  <h2>Its confidence tells the UI what to do</h2>
  <p class="sub">At ${PERCENT(pickThreshold)} or more, just use the model. Below that, put the top two side by side and let the user choose. Measured on ${s.briefs} held-out briefs that were never tuned against, ${s.routes / s.briefs} runs each:</p>
  <div class="stats">
    ${stat(`${s.pickedRight}/${s.picked}`, "confident picks were the right model")}
    ${stat(`${s.comparedInShortlist}/${s.compared}`, "unsure routes had the right model in the top two")}
    ${stat(`${s.latencyMs}ms`, "median time to route a brief")}
    ${stat(`$${s.costPer1000Usd.toFixed(3)}`, "per 1,000 routes")}
  </div>
  <p class="note">Half the held-out briefs are deliberately hard: the deciding cue is implied, buried or corrected mid-brief, and a brief was kept only if a keyword baseline routed it wrong.</p>
</section>`;
}

function routeChip(brief: ShootoutBrief, pickThreshold: number) {
  return brief.confidence >= pickThreshold
    ? `<span class="chip pick">${escapeHtml(categoryName(brief.routed))} · ${PERCENT(brief.confidence)}</span>`
    : `<span class="chip compare">${escapeHtml(categoryName(brief.routed))} · ${PERCENT(brief.confidence)} · show top two</span>`;
}

/** A clickable image: `index` is its place in the brief's lineup, where the lightbox starts. */
const frame = (shot: ShootoutShot, index: number, alt: string, caption = "") =>
  `<button class="frame" type="button" data-shot="${index}"${caption && ` data-caption="${escapeHtml(caption)}"`}><img src="${escapeHtml(shot.url)}" alt="${escapeHtml(alt)}" loading="lazy"></button>`;

function bigShot(brief: ShootoutBrief, shot: ShootoutShot | undefined, role: string) {
  if (!shot) return "";
  const pickTag = shot.picked ? `<span class="tag">best of 5</span>` : "";
  return `<figure class="${shot.picked ? "best" : ""}">
      ${frame(shot, brief.shots.indexOf(shot), `${role}: ${modelName(shot.generator)}`)}
      <figcaption><b>${role}</b><code>${escapeHtml(modelName(shot.generator))}</code>${pickTag}</figcaption>
    </figure>`;
}

/** "krea2 · routed · judge's pick": what the lightbox says about an image. */
function shotCaption(brief: ShootoutBrief, shot: ShootoutShot, defaultGenerator: string) {
  const roles = [
    shot.generator === brief.routedGenerator && "routed",
    shot.generator === defaultGenerator && "default",
    shot.picked && "judge's pick",
  ].filter(Boolean);
  return [modelName(shot.generator), ...roles].join(" · ");
}

const thumb = (brief: ShootoutBrief, defaultGenerator: string) => (shot: ShootoutShot, index: number) => `<figure class="${shot.picked ? "best" : ""}">
      ${frame(shot, index, modelName(shot.generator), shotCaption(brief, shot, defaultGenerator))}
      <figcaption><code>${escapeHtml(modelName(shot.generator))}</code></figcaption>
    </figure>`;

/** Routed beside default; when routing chose the default anyway, the judge's favourite other image takes the second slot. */
function pairOf(brief: ShootoutBrief, defaultGenerator: string) {
  const routed = brief.shots.find((shot) => shot.generator === brief.routedGenerator);
  if (brief.routedGenerator !== defaultGenerator) {
    return bigShot(brief, routed, "Routed") + bigShot(brief, brief.shots.find((shot) => shot.generator === defaultGenerator), "Default");
  }
  const [other] = brief.shots.filter((shot) => shot !== routed).toSorted((a, b) => b.probability - a.probability);
  return bigShot(brief, routed, "Routed, also the default") + bigShot(brief, other, other?.picked ? "Judge's pick" : "Runner-up");
}

const routedWon = (brief: ShootoutBrief) => brief.shots.some((shot) => shot.picked && shot.generator === brief.routedGenerator);

/** Clear routed wins first, then split calls, then losses: the reader meets the claim before its exceptions. */
const showOrder = (brief: ShootoutBrief) => (routedWon(brief) ? 0 : 2) + (brief.split ? 1 : 0);

/** Says outright which image the judge picked, so a reader never has to work out a miss from an outline. */
function verdict(brief: ShootoutBrief, defaultGenerator: string) {
  const best = modelName(brief.shots.find((shot) => shot.picked)?.generator ?? "");
  const split = brief.split ? ` A split call: most orderings of the images disagreed.` : "";
  if (routedWon(brief)) return `<p class="verdict hit"><b>Judge's pick: the routed model</b> (${escapeHtml(best)}).${split}</p>`;
  const whose = best === modelName(defaultGenerator) ? "the default model" : "neither the routed nor the default model";
  return `<p class="verdict miss"><b>Routing missed.</b> Judge's pick: ${escapeHtml(best)}, ${whose}.${split}</p>`;
}

function briefCard(brief: ShootoutBrief, defaultGenerator: string, pickThreshold: number) {
  return `<article>
  <div class="brief-head"><blockquote>${escapeHtml(brief.brief)}</blockquote>${routeChip(brief, pickThreshold)}</div>
  <div class="pair">${pairOf(brief, defaultGenerator)}</div>
  ${verdict(brief, defaultGenerator)}
  <div class="lineup"><p>All 5 models, same prompt and seed. Outlined: the judge's pick. Click any image to enlarge.</p>${brief.shots.map(thumb(brief, defaultGenerator)).join("")}</div>
</article>`;
}

function imagesSection(shootout: ShootoutEvidence, pickThreshold: number) {
  const briefs = shootout.briefs.length;
  const count = (share: number) => Math.round(share * briefs);
  return `<section>
  <h2>Does routing make better images?</h2>
  <p class="sub">${briefs} briefs, each rendered by all ${shootout.models} models in a local lineup. A vision judge picked the best image of each without knowing which was routed. The routed model made the best image for <b>${count(shootout.bestWas.routed)} of ${briefs}</b> briefs; one fixed default model managed ${count(shootout.bestWas.default)}, and chance would be ${count(1 / shootout.models)}. Every brief is shown, none filtered.</p>
  <div class="briefs">${shootout.briefs.toSorted((a, b) => showOrder(a) - showOrder(b)).map((b) => briefCard(b, shootout.defaultGenerator, pickThreshold)).join("\n")}</div>
  <p class="note">A small, early sample: ${briefs} briefs, judged by a model (Jev reading the images in every order), not yet checked against people. The lineup is open-weight models run locally, standing in for a real product's roster.</p>
</section>`;
}

export function showcasePage({ heldOut, shootout, pickThreshold, repoUrl, links, tryUrl }: ShowcaseInput): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Typecast</title>
<meta name="description" content="A model router for AI image generation: pick the right model for a brief in about 200ms, with a confidence you can act on.">
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
<header>
  <nav class="topbar" aria-label="Pages"><div class="brand"><i>T</i>Typecast</div><div class="pages">${links}</div></nav>
  <h1>The right image model for every brief, in a fifth of a second</h1>
  <p class="lede">AI media tools offer dozens of models, and users guess which fits their brief. A wrong pick wastes credits and time. Typecast reads the brief and picks the model, with a calibrated confidence, so the product knows when to just pick and when to show two.</p>
  <a class="try" href="${escapeHtml(tryUrl)}">Try it live</a>
</header>
${routingSection(heldOut, pickThreshold)}
${imagesSection(shootout, pickThreshold)}
<footer>
  <p>Routing runs on Jev, a decision model from TypeSafe that returns a typed choice with probabilities instead of text. The router knows nothing about any product: a roster is a list of categories and descriptions.</p>
  <p>Code, data and every number's method: <a href="${escapeHtml(repoUrl)}">${escapeHtml(repoUrl.replace(/^https:\/\//, ""))}</a></p>
</footer>
</div>
<dialog id="lightbox" aria-label="Image viewer" autofocus>
  <div class="lb-stage"><img alt=""><p class="lb-cap"><b></b><span></span></p></div>
  <button class="lb-prev" type="button" aria-label="Previous image">&#8249;</button>
  <button class="lb-next" type="button" aria-label="Next image">&#8250;</button>
  <button class="lb-close" type="button" aria-label="Close">&times;</button>
</dialog>
<script>${LIGHTBOX_SCRIPT}</script>
</body>
</html>
`;
}
