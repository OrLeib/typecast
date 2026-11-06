// The numbers behind the home page: held-out routing results, and every brief of the latest judged shootout with the
// routed and default images side by side.
import { PICK_THRESHOLD } from "../routing/recommendation.ts";
import { FAVICON_LINK, REPO_URL } from "../shared/brand.ts";
import { escapeHtml } from "../shared/format.ts";
import type { Evidence } from "./evidence.ts";
import { frame, LIGHTBOX, LIGHTBOX_STYLE, modelName, shotCaption } from "./lightbox.ts";
import { BASE_STYLE, pageNav } from "./page-style.ts";
import type { ShootoutBrief, ShootoutEvidence, ShootoutShot } from "./shootout-evidence.ts";

export type ShowcaseInput = {
  /** Every brief set's latest run; only the held-out ones are shown. */
  evidence: Evidence[];
  /** The latest judged shootout, if any. */
  shootout?: ShootoutEvidence;
};

/** Sets never tuned against (see "Measuring a change without overfitting" in CLAUDE.md), so their numbers are the honest ones. */
const HELD_OUT = new Set(["data/test.jsonl", "data/hard.jsonl"]);

const STYLE = `
  body { font-size: 16px; }
  h1 { margin: 28px 0 14px; font-size: clamp(30px, 5vw, 46px); line-height: 1.08; letter-spacing: -0.03em; font-weight: 680; max-width: 20ch; }
  .lede { font-size: 18px; max-width: 60ch; text-wrap: pretty; }
  section { margin-top: 56px; }
  h2 { margin: 0 0 8px; font-size: 22px; line-height: 1.25; letter-spacing: -0.015em; font-weight: 650; text-wrap: balance; }
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
  .chip.pick { background: var(--good-bg); color: var(--good-text); }
  .chip.compare { background: var(--warn-bg); color: var(--warn-text); }
  .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  figure { margin: 0; display: flex; flex-direction: column; gap: 8px; }
  figcaption { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 14px; color: var(--text-2); }
  figcaption b { color: var(--text); font-weight: 600; }
  code { font: 12.5px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--muted); }
  .tag { font-size: 12px; font-weight: 600; padding: 1px 8px; border-radius: 999px; color: var(--accent-text); background: var(--accent-soft); }
  .verdict { margin: 16px 0 0; padding: 10px 14px; border-radius: 10px; font-size: 14px; }
  .verdict.hit { background: var(--good-bg); color: var(--good-text); }
  .verdict.miss { background: var(--warn-bg); color: var(--warn-text); }
  .scores { display: grid; grid-template-columns: auto minmax(0, 1fr) 2ch; align-items: center; gap: 4px 10px; margin: auto 0 0; font-size: 13px; color: var(--text-2); }
  .scores dt { font-weight: 550; }
  .scores dd { margin: 0; font-variant-numeric: tabular-nums; text-align: right; }
  .scores dd.track { height: 6px; background: var(--track); border-radius: 3px; overflow: hidden; }
  .scores dd.track i { display: block; height: 100%; background: var(--bar-rest); }
  .scores dt.total, .scores dd.total { color: var(--text); font-weight: 650; }
  .scores dd.track.total i { background: var(--accent); }
  .lineup { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); display: grid; grid-template-columns: auto repeat(5, minmax(0, 110px)); align-items: center; gap: 12px; }
  .lineup p { margin: 0; font-size: 13px; color: var(--muted); max-width: 24ch; }
  .lineup figure { gap: 4px; }
  .lineup .frame { border-radius: 6px; outline-width: 2px; outline-offset: 2px; }
  .lineup figcaption { font-size: 12px; flex-direction: column; flex-wrap: nowrap; gap: 2px; }
  .lineup code { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  footer { margin: 64px 0 56px; padding: 20px 0 0; border-top: 1px solid var(--line); font-size: 14px; }
  footer p { margin: 0 0 8px; max-width: 80ch; }
  a { color: var(--accent-text); }
  @media (max-width: 760px) {
    .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    article { padding: 16px; }
    .pair { gap: 10px; }
    .lineup { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    /* Two images fit side by side here, so the longest label would squeeze every bar; the overall score keeps its number. */
    .scores dd.track.total { display: none; }
    .scores dt.total { grid-column: span 2; }
    .lineup p { grid-column: 1 / -1; max-width: none; }
  }
`;

const PERCENT = (x: number) => `${Math.round(x * 100)}%`;

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
    accuracy: sum(heldOut.map((e) => (e.metrics.accuracy ?? 0) * e.n)) / sum(heldOut.map((e) => e.n)),
  };
}

const stat = (value: string, label: string) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`;

function routingSection(evidence: Evidence[]) {
  const heldOut = evidence.filter((e) => HELD_OUT.has(e.data));
  if (!heldOut.length) return "";
  const s = heldOutStats(heldOut);
  return `<section>
  <h2>The confidence says when to just pick</h2>
  <p class="sub">At ${PERCENT(PICK_THRESHOLD)} or more, just use the model. Below that, put the top two side by side and let the user choose. Measured on ${s.briefs} held-out briefs that were never tuned against, ${s.routes / s.briefs} runs each:</p>
  <div class="stats">
    ${stat(`${s.pickedRight}/${s.picked}`, "confident picks matched the labelled category")}
    ${stat(`${s.comparedInShortlist}/${s.compared}`, "unsure routes had the labelled category in the top two")}
    ${stat(`${s.latencyMs}ms`, "median time to route a brief")}
    ${stat(`$${s.costPer1000Usd.toFixed(3)}`, "per 1,000 routes")}
  </div>
  <p class="note">Half the held-out briefs are deliberately hard: the deciding cue is implied, buried or corrected mid-brief, and a brief was kept only if a keyword baseline routed it wrong. First picks matched the label on ${PERCENT(s.accuracy)} of all routes.</p>
</section>`;
}

function routeChip(brief: ShootoutBrief) {
  return brief.confidence >= PICK_THRESHOLD
    ? `<span class="chip pick">${escapeHtml(categoryName(brief.routed))} · ${PERCENT(brief.confidence)}</span>`
    : `<span class="chip compare">${escapeHtml(categoryName(brief.routed))} · ${PERCENT(brief.confidence)} · show top two</span>`;
}

const outOf100 = (x: number) => String(Math.round(x * 100));

const scoreRow = (label: string, value: number, kind = "") => `<dt class="${kind}">${label}</dt><dd class="track ${kind}"><i style="width:${PERCENT(value)}"></i></dd><dd class="${kind}">${outOf100(value)}</dd>`;

/** The image's scores out of 100, the overall score first, so a reader sees where it won or lost. */
function scoresOf(shot: ShootoutShot) {
  if (!shot.rating) return "";
  const rows = Object.entries(shot.rating.scores).map(([criterion, value]) => scoreRow(escapeHtml(criterion), value));
  return `<dl class="scores">${scoreRow("Overall score", shot.rating.total, "total")}${rows.join("")}</dl>`;
}

function bigShot(brief: ShootoutBrief, shot: ShootoutShot | undefined, role: string) {
  if (!shot) return "";
  const pickTag = shot.picked ? `<span class="tag">best of 5</span>` : "";
  return `<figure class="${shot.picked ? "best" : ""}">
      ${frame(shot, brief.shots.indexOf(shot), `${role}: ${modelName(shot.generator)}`)}
      <figcaption><b>${role}</b><code>${escapeHtml(modelName(shot.generator))}</code>${pickTag}</figcaption>
      ${scoresOf(shot)}
    </figure>`;
}

const thumb = (brief: ShootoutBrief, defaultGenerator: string) => (shot: ShootoutShot, index: number) => `<figure class="${shot.picked ? "best" : ""}">
      ${frame(shot, index, modelName(shot.generator), shotCaption(brief, shot, defaultGenerator))}
      <figcaption><code>${escapeHtml(modelName(shot.generator))}</code>${shot.rating ? ` ${outOf100(shot.rating.total)}` : ""}</figcaption>
    </figure>`;

/** Routed beside default; when routing chose the default anyway, the judge's favourite other image takes the second slot. */
function pairOf(brief: ShootoutBrief, defaultGenerator: string) {
  const routed = brief.shots.find((shot) => shot.generator === brief.routedGenerator);
  if (brief.routedGenerator !== defaultGenerator) {
    return bigShot(brief, routed, "Typecast's pick") + bigShot(brief, brief.shots.find((shot) => shot.generator === defaultGenerator), "Default");
  }
  const [other] = brief.shots.filter((shot) => shot !== routed).toSorted((a, b) => b.probability - a.probability);
  return bigShot(brief, routed, "Typecast's pick, also the default") + bigShot(brief, other, other?.picked ? "Judge's pick" : "Runner-up");
}

const routedWon = (brief: ShootoutBrief) => brief.shots.some((shot) => shot.picked && shot.generator === brief.routedGenerator);

/** Clear routed wins first, then split calls, then losses: the reader meets the claim before its exceptions. */
const showOrder = (brief: ShootoutBrief) => (routedWon(brief) ? 0 : 2) + (brief.split ? 1 : 0);

/** Which image scored highest, when that isn't the pick: the two looks disagreeing is worth saying on the brief itself. */
function scoreDisagreement(brief: ShootoutBrief) {
  const rated = brief.shots.filter((shot) => shot.rating);
  if (!rated.length) return "";
  const [top] = rated.toSorted((a, b) => (b.rating?.total ?? 0) - (a.rating?.total ?? 0));
  return top.picked ? "" : ` Highest overall score: ${escapeHtml(modelName(top.generator))}.`;
}

/** Says outright which image the judge picked, so a reader never has to work out a miss from an outline. */
function verdict(brief: ShootoutBrief, defaultGenerator: string) {
  const best = modelName(brief.shots.find((shot) => shot.picked)?.generator ?? "");
  const split = `${brief.split ? ` A split call: most orderings of the images disagreed.` : ""}${scoreDisagreement(brief)}`;
  if (routedWon(brief)) return `<p class="verdict hit"><b>Judge's pick: the routed model</b> (${escapeHtml(best)}).${split}</p>`;
  const whose = best === modelName(defaultGenerator) ? "the default model" : "neither the routed nor the default model";
  return `<p class="verdict miss"><b>Routing missed.</b> Judge's pick: ${escapeHtml(best)}, ${whose}.${split}</p>`;
}

function briefCard(brief: ShootoutBrief, defaultGenerator: string) {
  return `<article>
  <div class="brief-head"><blockquote>${escapeHtml(brief.brief)}</blockquote>${routeChip(brief)}</div>
  <div class="pair">${pairOf(brief, defaultGenerator)}</div>
  ${verdict(brief, defaultGenerator)}
  <div class="lineup"><p>All 5 models, same prompt and seed. Outlined: the judge's pick. Click any image to enlarge.</p>${brief.shots.map(thumb(brief, defaultGenerator)).join("")}</div>
</article>`;
}

/** The second look, reported whether or not it flatters the first. */
function rubricNote({ rubric, briefs }: ShootoutEvidence) {
  if (!rubric) return "";
  return ` A second look scored each image alone, out of 100, on following the brief, style, craft and any text the brief asks for. Those scores are less kind: the routed model had the highest overall score on ${rubric.topWas.routed} of ${briefs.length}, the default on ${rubric.topWas.default}, and the top-scoring image was the judge's pick on ${rubric.agreesWithPick}.`;
}

function imagesSection(shootout: ShootoutEvidence | undefined) {
  if (!shootout) return "";
  const briefs = shootout.briefs.length;
  const count = (share: number) => Math.round(share * briefs);
  return `<section>
  <h2>Does routing make better images?</h2>
  <p class="sub">${briefs} briefs, each rendered by all ${shootout.models} models in a local lineup. A vision judge picked the best image of each without knowing which was routed. The routed model made the best image for <b>${count(shootout.bestWas.routed)} of ${briefs}</b> briefs; one fixed default model managed ${count(shootout.bestWas.default)}, and chance would be ${count(1 / shootout.models)}.${rubricNote(shootout)} Every brief is shown, none filtered.</p>
  <div class="briefs">${shootout.briefs.toSorted((a, b) => showOrder(a) - showOrder(b)).map((b) => briefCard(b, shootout.defaultGenerator)).join("\n")}</div>
  <p class="note">A small, early sample: ${briefs} briefs that routing was tuned on, judged by a model (Jev reading the images in every order), not yet checked against people. The lineup is open-weight models run locally, standing in for a real product's roster.</p>
</section>`;
}

export function showcasePage({ evidence, shootout }: ShowcaseInput): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Typecast: the numbers</title>
${FAVICON_LINK}
<style>${BASE_STYLE}${LIGHTBOX_STYLE}${STYLE}</style>
</head>
<body>
<div class="wrap">
<header class="top">
  ${pageNav("results")}
  <h1>The numbers</h1>
  <p class="lede">How well the routing holds up on briefs it never saw, and what it does for the images. Finding the subject isn't measured yet.</p>
</header>
${routingSection(evidence)}
${imagesSection(shootout)}
<footer>
  <p>Routing runs on Jev, a decision model from TypeSafe that returns a typed choice with probabilities instead of text. The router knows nothing about any product: a roster is a list of categories and descriptions.</p>
  <p>Code, data and every number's method: <a href="${REPO_URL}">${REPO_URL.replace(/^https:\/\//, "")}</a></p>
</footer>
</div>
${LIGHTBOX}
</body>
</html>
`;
}
