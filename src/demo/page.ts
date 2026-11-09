// The demo page. Self-contained: no build step, no external assets, works offline.
// Page script avoids template literals so this file can stay one template string.
import { FAVICON_LINK } from "../shared/brand.ts";
import { BASE_STYLE, pageNav, WITH_MOTION } from "./page-style.ts";

/** Hosted, there is no Mac to render on, so the page routes but hides rendering, comparing and judging. */
export const demoPage = ({ hosted }: { hosted: boolean }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Typecast: which model</title>
${FAVICON_LINK}
<style>
${BASE_STYLE}
  .composer { padding: 16px; }
  textarea { width: 100%; min-height: 84px; resize: vertical; border: 0; outline: 0; background: transparent; color: var(--text); font: inherit; font-size: 17px; line-height: 1.5; padding: 4px 4px 8px; }
  textarea::placeholder { color: var(--muted); }
  .composer-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 12px; border-top: 1px solid var(--line); }
  .examples-head { display: flex; align-items: center; justify-content: space-between; gap: 8px 16px; flex-wrap: wrap; margin-bottom: 12px; }
  .examples-head .section-title { margin: 0; }
  .filters { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; max-width: 100%; }
  .filters::-webkit-scrollbar { display: none; }
  .filters button { flex: none; font-size: 13px; font-weight: 500; padding: 5px 11px; border-radius: 999px; color: var(--text-2); background: transparent; }
  .filters button span { color: var(--muted); font-weight: 450; margin-left: 4px; font-variant-numeric: tabular-nums; }
  .filters button[aria-pressed="true"] { background: var(--text); border-color: var(--text); color: var(--bg); }
  .filters button[aria-pressed="true"] span { color: inherit; opacity: .7; }
  .examples { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .example { display: flex; flex-direction: column; gap: 8px; text-align: left; font-weight: 400; padding: 12px 14px; border-radius: 12px; background: var(--surface); min-height: 112px; }
  .example.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
  .example-tags { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
  .example-tags b { color: var(--text-2); font-weight: 600; }
  .example-tags .borderline { padding: 0 6px; border-radius: 999px; border: 1px dashed var(--muted); line-height: 17px; }
  .example-text { font-size: 14px; line-height: 1.45; color: var(--text); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .examples-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
  .examples-foot button { font-size: 13px; padding: 6px 12px; }
  .label-check { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 13px; color: var(--text-2); }
  .label-check[hidden] { display: none; }
  .label-check svg { width: 14px; height: 14px; flex: none; }
  .label-check.match svg { color: var(--good); }
  .label-check.miss svg { color: var(--danger); }
  .label-check b { color: var(--text); font-weight: 600; }
  #result { display: none; }
  .result-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); }
  .verdict { padding: 24px; border-right: 1px solid var(--line); display: flex; flex-direction: column; gap: 14px; }
  .badge { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding: 4px 10px 4px 8px; border-radius: 999px; }
  .badge svg { width: 14px; height: 14px; }
  .badge.pick { color: var(--good-text); background: var(--good-bg); }
  .badge.compare { color: var(--warn-text); background: var(--warn-bg); }
  .choice { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 4px 12px; }
  .choice-model { display: flex; flex-direction: column; gap: 2px; }
  .choice-model b { font-size: 30px; font-weight: 650; letter-spacing: -0.02em; line-height: 1.1; }
  .choice-model span { font-size: 13px; color: var(--text-2); }
  .choice .vs { color: var(--muted); font-weight: 500; font-size: 20px; line-height: 33px; }
  .confidence { display: flex; align-items: baseline; gap: 8px; }
  .confidence b { font-size: 44px; font-weight: 650; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; line-height: 1; }
  .confidence span { color: var(--text-2); }
  .explain { color: var(--text-2); margin: 0; font-size: 14px; }
  .reasons { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .reasons[hidden] { display: none; }
  .reasons-title { width: 100%; font-size: 13px; font-weight: 550; color: var(--text-2); }
  .reason { font-size: 13px; line-height: 1.3; padding: 3px 10px; border-radius: 999px; color: var(--text-2); background: var(--track); }
  .reason.deciding { color: var(--accent-text); background: var(--accent-soft); font-weight: 600; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 16px; color: var(--muted); font-size: 13px; margin-top: auto; padding-top: 8px; font-variant-numeric: tabular-nums; }
  .meta strong { color: var(--text-2); font-weight: 550; }
  .bars { padding: 24px; }
  .bars-title { margin: 0 0 6px; font-size: 13px; font-weight: 550; color: var(--text-2); }
  .meter { margin-top: -4px; }
  .meter .fill { background: var(--accent); }
  .bar-row { display: grid; grid-template-columns: 112px minmax(0, 1fr); align-items: center; gap: 12px; padding: 7px 0; }
  .bar-label { font-size: 14px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar-row.on .bar-label { color: var(--text); font-weight: 600; }
  .track { position: relative; height: 10px; background: var(--track); border-radius: 5px; }
  .fill { position: absolute; inset: 0 auto 0 0; border-radius: 5px; background: var(--bar-rest); }
  .bar-row.on .fill { background: var(--accent); }
  .bar-row.second .fill { background: var(--accent-2); }
  .bar-row.second .bar-label { color: var(--text); }
  .threshold { position: absolute; top: -5px; bottom: -5px; width: 0; border-left: 1.5px dashed var(--muted); }
  .pick-line { display: flex; align-items: center; gap: 8px; margin: -6px 0 0; color: var(--muted); font-size: 12px; }
  .pick-line i { width: 0; height: 12px; border-left: 1.5px dashed var(--muted); }
  .render { border-top: 1px solid var(--line); padding: 24px; }
  .render-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
  .render-head p { margin: 0; color: var(--text-2); font-size: 14px; }
  .render-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  /* Capped so a route and its images fit on one laptop screen. */
  .shots { display: grid; gap: 16px; grid-template-columns: repeat(var(--cols, 1), minmax(0, min(340px, 34vh))); }
  .shot { display: flex; flex-direction: column; gap: 8px; }
  .frame { aspect-ratio: 1; border-radius: 10px; background: var(--surface-2); overflow: hidden; display: grid; place-items: center; position: relative; }
  .frame img { width: 100%; height: 100%; object-fit: cover; display: block; animation: fade .4s ease; }
  .frame .state { color: var(--muted); font-size: 13px; text-align: center; padding: 16px; font-variant-numeric: tabular-nums; }
  .spinner { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--line); border-top-color: var(--text-2); animation: pulse .9s ease-in-out infinite alternate; margin: 0 auto 10px; }
  @keyframes pulse { from { opacity: .35; } }
  .progress { width: 140px; height: 3px; margin: 10px auto 0; border-radius: 2px; background: var(--track); overflow: hidden; visibility: hidden; }
  .progress.known { visibility: visible; }
  .progress-fill { height: 100%; width: 0; background: var(--accent); }
  ${WITH_MOTION} {
    .fill { transition: width .5s var(--ease); }
    .spinner { animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .progress-fill { transition: width .3s ease; }
  }
  .shot-caption { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; font-size: 13px; color: var(--text-2); }
  .shot-caption code { font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--muted); white-space: nowrap; }
  .shot.winner .frame { outline: 2px solid var(--accent); outline-offset: 3px; }
  .pick-tag { display: inline-block; margin-left: 8px; padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 600; color: var(--accent-text); background: var(--accent-soft); }
  .verdict-line { display: none; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 14px; color: var(--text-2); }
  .verdict-line strong { color: var(--text); font-weight: 600; }
  .verdict-line .odds { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 6px; font-variant-numeric: tabular-nums; }
  .verdict-line .odds span { color: var(--muted); }
  .verdict-line .odds b { color: var(--text-2); font-weight: 550; }
  .set-about { margin: -4px 0 12px; font-size: 14px; color: var(--text-2); max-width: 62ch; }
  .evidence-headline { margin: 0; padding: 22px 24px 0; font-size: 18px; line-height: 1.4; font-weight: 600; letter-spacing: -0.01em; max-width: 64ch; text-wrap: pretty; }
  .outcomes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 16px 24px 24px; }
  .outcome { display: flex; flex-direction: column; gap: 10px; padding: 16px; border-radius: 12px; background: var(--surface-2); }
  .outcome .value { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 6px; font-size: 30px; font-weight: 650; letter-spacing: -0.02em; line-height: 1.15; font-variant-numeric: tabular-nums; }
  .outcome .value span { font-size: 15px; font-weight: 500; letter-spacing: 0; color: var(--text-2); }
  .outcome p { margin: 0; font-size: 13px; color: var(--text-2); text-wrap: pretty; }
  .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding-top: 8px; }
  .evidence-foot { margin: 0 0 8px; font-size: 13px; color: var(--muted); }
  .evidence-foot b { color: var(--text-2); font-weight: 550; }
  .term { border-bottom: 1px dotted currentColor; cursor: help; }
  .term:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 2px; }
  .tile { padding: 12px 16px 12px 0; }
  .tile .label { font-size: 13px; color: var(--text-2); }
  .tile .value { color: var(--text); font-size: 26px; font-weight: 650; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; margin-top: 2px; }
  .tile .sub { font-size: 12px; color: var(--muted); }
  .chart { padding: 12px 0 4px; max-width: 520px; }
  .chart p { margin: 0 0 10px; font-size: 13px; color: var(--text-2); max-width: 62ch; }
  .chart svg { display: block; width: 100%; height: auto; overflow: visible; }
  .chart .axis text { fill: var(--muted); font-size: 11px; }
  .chart .grid line { stroke: var(--line); }
  /* The halo keeps a count readable where it crosses the dashed diagonal. */
  .chart .count { fill: var(--muted); font-size: 10px; font-variant-numeric: tabular-nums; paint-order: stroke; stroke: var(--surface); stroke-width: 3px; stroke-linejoin: round; pointer-events: none; }
  .tooltip { position: absolute; z-index: 10; pointer-events: none; background: var(--text); color: var(--bg); font-size: 12px; line-height: 1.45; padding: 6px 9px; border-radius: 7px; width: max-content; max-width: min(300px, calc(100vw - 32px)); opacity: 0; transition: opacity .1s; font-variant-numeric: tabular-nums; }
  details { padding: 14px 24px; border-top: 1px solid var(--line); color: var(--text-2); font-size: 13px; }
  summary { cursor: pointer; color: var(--text-2); font-weight: 550; }
  table { border-collapse: collapse; margin-top: 8px; font-variant-numeric: tabular-nums; }
  th, td { text-align: right; padding: 4px 12px 4px 0; }
  th:first-child, td:first-child { text-align: left; }
  th { font-weight: 550; color: var(--muted); }
  .empty { padding: 24px; color: var(--muted); font-size: 14px; }
  #error { color: var(--danger); font-size: 14px; margin: 12px 0 0; }
  @media (max-width: 760px) {
    .result-grid { grid-template-columns: 1fr; }
    .verdict { border-right: 0; border-bottom: 1px solid var(--line); }
    .evidence-headline { padding: 18px 16px 0; font-size: 17px; }
    .outcomes { grid-template-columns: 1fr; padding: 14px 16px 18px; }
    .stats { grid-template-columns: 1fr 1fr; }
    details { padding: 14px 16px; }
    .shots { grid-template-columns: 1fr; }
    /* The placeholder wraps to three lines on a phone; this keeps it from scrolling. */
    textarea { min-height: 96px; }
    .hint { display: none; }
    .bar-row { grid-template-columns: 96px minmax(0, 1fr); }
    .examples { grid-template-columns: 1fr; }
    .example { min-height: 0; }
  }
  @media (min-width: 761px) and (max-width: 960px) {
    .examples { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    ${pageNav("route")}
    <h1>Which image model should make this?</h1>
    <p class="lede">Describe what you want. Typecast picks the best kind of model in about 200ms, and shows two if it isn't sure.${hosted ? " This hosted demo picks the model. It doesn't render the image." : ""}</p>
  </header>

  <div class="card composer">
    <textarea id="brief" placeholder="e.g. Hero image for a spring sneaker campaign, shoe floating on a pastel backdrop" aria-label="Creative brief"></textarea>
    <div class="composer-foot">
      <span class="hint"><kbd>⌘</kbd> <kbd>↵</kbd> to pick</span>
      <button class="primary" id="route">Pick a model</button>
    </div>
  </div>
  <p id="error" role="alert"></p>

  <section aria-labelledby="examples-title">
    <div class="examples-head">
      <h2 class="section-title" id="examples-title">Try an example</h2>
      <div class="filters" id="filters" role="group" aria-label="Filter examples by label"></div>
    </div>
    <div class="examples" id="examples"></div>
    <div class="examples-foot"><span id="examples-count"></span><button id="more-examples">Show more</button></div>
  </section>

  <section id="result" aria-live="polite">
    <h2 class="section-title">Routing</h2>
    <div class="card">
      <div class="result-grid">
        <div class="verdict">
          <span class="badge" id="badge"></span>
          <div class="choice" id="choice"></div>
          <div class="confidence"><b id="confidence"></b><span data-term="confidence">confidence</span></div>
          <div class="track meter"><div class="fill" id="confidence-fill"></div><div class="threshold" id="pick-mark"></div></div>
          <p class="pick-line"><i></i><span id="threshold-label"></span></p>
          <p class="explain" id="explain"></p>
          <div class="reasons" id="reasons" hidden></div>
          <p class="label-check" id="label-check" hidden></p>
          <div class="meta" id="meta"></div>
        </div>
        <div class="bars">
          <h3 class="bars-title">Probability per category</h3>
          <div id="bars"></div>
        </div>
      </div>
      <div class="render"${hosted ? " hidden" : ""}>
        <div class="render-head"><p id="render-text"></p><div class="render-actions"><button id="render">Render</button><button id="compare-default">Compare with default</button><button id="judge">Judge with Jev</button></div></div>
        <div class="shots" id="shots"></div>
        <div class="verdict-line" id="jev-verdict" aria-live="polite"></div>
      </div>
    </div>
  </section>

  <section id="evidence">
    <h2 class="section-title">Why trust the confidence</h2>
    <p class="set-about" id="set-about"></p>
    <div class="card" id="evidence-card"></div>
  </section>

  <footer>${hosted ? 'Routing calls the <span data-term="jev">Jev</span> decision API live. Rendering runs only in the local demo, on a Mac with mflux.' : 'Runs locally. Routing calls the <span data-term="jev">Jev</span> decision API; images render on this Mac with mflux.'}</footer>
</div>
<div class="tooltip" id="tooltip" role="tooltip"></div>

<script>
  var $ = function (id) { return document.getElementById(id); };
  var config = null, lastRoute = null, lastBrief = "", busy = false;
  var CAN_RENDER = ${!hosted};
  var ICONS = {
    pick: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>',
    miss: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
    compare: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="2" y="3" width="5" height="10" rx="1.2"/><rect x="9" y="3" width="5" height="10" rx="1.2"/></svg>'
  };
  // The hard held-out set: never tuned against, and its briefs are built to mislead, so the confidence has to earn its numbers there.
  var EVIDENCE_SET = { data: "data/hard.jsonl", about: "Tricky briefs whose deciding cue is implied, buried or contradicted. Never tuned against." };

  function termText(key) {
    return {
      jev: "Jev is a decision model from TypeSafe. Instead of writing text like a chatbot, it answers a multiple-choice question and gives a probability for each option. Typecast asks it which model category fits the brief.",
      confidence: "How sure Jev is about its pick, from 0 to 100%. At " + pct(config.pickThreshold) + " or more Typecast just uses that model; below it, it shows the top two side by side.",
      ece: "Expected Calibration Error: the average gap between how sure Jev said it was and how often it was actually right. 0 is perfect; 0.05 means about 5 points off.",
      latency: "Median time for one decision, including the round trip to Jev's API.",
      cost: "Jev bills only the text sent to it (input tokens). Its answer is free.",
      version: "The exact Jev version that answered. Typecast asks for jev-latest, and the API reports which version that was.",
      variant: "The wording sent to Jev: the question plus a one-line description of each category. Typecast tries different wordings and keeps the one that scores best on briefs it was never tuned on.",
      route: "One decision: one brief sent to Jev once. Each brief was routed more than once, because Jev's numbers can shift slightly between calls."
    }[key];
  }
  function markTerm(node, key) {
    node.dataset.term = key; node.classList.add("term"); node.tabIndex = 0; node.setAttribute("aria-describedby", "tooltip");
    return node;
  }
  function term(text, key) { return markTerm(el("span", null, text), key); }
  function showTerm(node) {
    var tip = $("tooltip"), box = node.getBoundingClientRect();
    tip.textContent = termText(node.dataset.term);
    tip.style.left = Math.max(8, Math.min(box.left, window.innerWidth - tip.offsetWidth - 8)) + "px";
    tip.style.top = (box.bottom + window.scrollY + 6) + "px";
    tip.style.opacity = 1;
  }
  function termAt(target) { return config && target.closest ? target.closest("[data-term]") : null; }
  function hideTermLeaving(e) { var t = termAt(e.target); if (t && !t.contains(e.relatedTarget)) $("tooltip").style.opacity = 0; }
  document.addEventListener("mouseover", function (e) { var t = termAt(e.target); if (t) showTerm(t); });
  document.addEventListener("focusin", function (e) { var t = termAt(e.target); if (t) showTerm(t); });
  document.addEventListener("mouseout", hideTermLeaving);
  document.addEventListener("focusout", hideTermLeaving);

  function pct(x, digits) { return (x * 100).toFixed(digits == null ? 0 : digits) + "%"; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function generatorOf(id) { var r = config.roster.find(function (c) { return c.id === id; }); return r && r.generator; }
  /** A shot renders a routed category, or the default model when its target is DEFAULT. */
  var DEFAULT = "default";
  function generatorFor(target) { return target === DEFAULT ? config.defaultGenerator : generatorOf(target); }
  function modelName(g) { return g ? g.replace(/^mflux:/, "").replace(/@q\\d+(\\+g[\\d.]+)?$/, "") : null; }

  async function api(path, body) {
    var res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
    if (!res.ok) throw await failure(res);
    return res.json();
  }

  // The server answers errors as JSON, but a proxy in front of the hosted site (a 413 or 502) may not, so a status line stands in.
  async function failure(res) {
    var data = await res.json().catch(function () { return {}; });
    return new Error(data.error || (res.statusText || "Request failed") + " (" + res.status + ")");
  }

  async function stream(path, body, onEvent) {
    var res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw await failure(res);
    var reader = res.body.getReader(), decoder = new TextDecoder(), buffered = "";
    for (;;) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buffered += decoder.decode(chunk.value, { stream: true });
      var lines = buffered.split("\\n");
      buffered = lines.pop();
      lines.forEach(function (line) { if (line) onEvent(JSON.parse(line)); });
    }
  }

  async function init() {
    config = await api("/api/config");
    Array.prototype.forEach.call(document.querySelectorAll("[data-term]"), function (n) { markTerm(n, n.dataset.term); });
    renderFilters();
    renderExamples();
    $("threshold-label").textContent = "Just picks at " + pct(config.pickThreshold) + " or more. Below that, shows the top two.";
    $("pick-mark").style.left = pct(config.pickThreshold, 1);
    renderEvidence();
  }

  /** Examples shown per page, and more on each "Show more": two rows of three. */
  var EXAMPLES_PAGE = 6;
  var BORDERLINE = "borderline";
  var exampleFilter = "all", examplesShown = EXAMPLES_PAGE;

  /** Interleaves labels so the first page of "All" shows every category, not one cluster of the file: each label's first brief, then each one's second, and so on. */
  function interleaved(examples) {
    var seen = {};
    return examples
      .map(function (e) { seen[e.expected] = (seen[e.expected] || 0) + 1; return { example: e, round: seen[e.expected] }; })
      .sort(function (a, b) { return a.round - b.round; })
      .map(function (r) { return r.example; });
  }
  function filteredExamples() {
    if (exampleFilter === "all") return interleaved(config.examples);
    return config.examples.filter(function (e) { return exampleFilter === BORDERLINE ? e.note : e.expected === exampleFilter; });
  }
  function exampleFor(brief) { return config.examples.find(function (e) { return e.brief === brief; }); }

  function renderFilters() {
    var options = [["all", "All", config.examples.length]].concat(
      config.roster.map(function (c) { return [c.id, c.id, config.examples.filter(function (e) { return e.expected === c.id; }).length]; }),
      [[BORDERLINE, "Borderline", config.examples.filter(function (e) { return e.note; }).length]]);
    var filters = $("filters"); filters.textContent = "";
    options.filter(function (o) { return o[2] > 0; }).forEach(function (o) {
      var b = el("button", null, o[1]);
      b.appendChild(el("span", null, String(o[2])));
      b.setAttribute("aria-pressed", String(o[0] === exampleFilter));
      b.addEventListener("click", function () { exampleFilter = o[0]; examplesShown = EXAMPLES_PAGE; renderFilters(); renderExamples(); });
      filters.appendChild(b);
    });
  }

  function renderExamples() {
    var all = filteredExamples(), shown = all.slice(0, examplesShown);
    var grid = $("examples"); grid.textContent = "";
    shown.forEach(function (ex) {
      var card = el("button", "example");
      var tags = el("span", "example-tags");
      tags.appendChild(el("span", null, "Expected"));
      tags.appendChild(el("b", null, ex.expected));
      if (ex.note) { tags.appendChild(el("span", "borderline", "borderline")); card.title = ex.note; }
      card.appendChild(tags);
      card.appendChild(el("span", "example-text", ex.brief));
      card.addEventListener("click", function () { $("brief").value = ex.brief; markActiveExample(); route(); });
      grid.appendChild(card);
    });
    markActiveExample();
    $("examples-count").textContent = "Showing " + shown.length + " of " + all.length + " dev briefs";
    $("more-examples").hidden = shown.length >= all.length;
  }
  function markActiveExample() {
    var brief = $("brief").value.trim();
    Array.prototype.forEach.call(document.querySelectorAll("#examples .example"), function (card) {
      card.classList.toggle("active", card.querySelector(".example-text").textContent === brief);
    });
  }

  /** For a labelled example, says whether the route agrees with its label. */
  function showLabelCheck(rec) {
    var check = $("label-check"), ex = exampleFor(lastBrief);
    check.hidden = !ex;
    if (!ex) return;
    var rank = rec.shortlist.indexOf(ex.expected);
    check.className = "label-check " + (rank === -1 ? "miss" : "match");
    check.innerHTML = rank === -1 ? ICONS.miss : ICONS.pick;
    var text = el("span");
    text.appendChild(document.createTextNode("Expected "));
    text.appendChild(el("b", null, ex.expected));
    text.appendChild(document.createTextNode(rank === 0 ? ", same as the pick" : rank === 1 ? ", the second of the two" : ", not in the shortlist"));
    check.appendChild(text);
    if (ex.note) check.title = ex.note; else check.removeAttribute("title");
  }

  async function route() {
    var brief = $("brief").value.trim();
    if (!brief) { $("error").textContent = "Describe what you want first."; $("brief").focus(); return; }
    if (busy) return;
    busy = true; $("route").disabled = true; $("route").textContent = "Picking…"; $("error").textContent = "";
    try {
      lastRoute = await api("/api/route", { brief: brief });
      lastBrief = brief;
      showRoute(lastRoute);
      markActiveExample();
      $("result").scrollIntoView({ block: "start" });
    } catch (e) {
      $("error").textContent = e.message;
    } finally {
      busy = false; $("route").disabled = false; $("route").textContent = "Pick a model";
    }
  }

  function showRoute(r) {
    var rec = r.recommendation, compare = rec.mode === "compare";
    $("result").style.display = "block";
    var badge = $("badge");
    badge.className = "badge " + rec.mode;
    badge.innerHTML = ICONS[rec.mode] + (compare ? "Unsure: compare two" : "Confident: just pick");
    var choice = $("choice"); choice.textContent = "";
    choice.appendChild(choiceModel(rec.shortlist[0]));
    if (compare) { choice.appendChild(el("span", "vs", "or")); choice.appendChild(choiceModel(rec.shortlist[1])); }
    $("confidence").textContent = pct(r.confidence);
    growBar($("confidence-fill"), r.confidence);
    $("explain").textContent = compare
      ? "Below " + pct(config.pickThreshold) + ", so show both and let the user choose."
      : "At " + pct(config.pickThreshold) + " or more, so use this model without asking.";
    showReasons(r.explanation);
    var meta = $("meta"); meta.textContent = "";
    [[r.cached ? "Latency, cached" : "Latency", Math.round(r.latencyMs) + " ms"], ["Cost", "$" + r.costUsd.toFixed(6)], ["Model", r.model, "version"]].forEach(function (m) {
      var span = el("span"), strong = el("strong", null, m[1]);
      span.appendChild(m[2] ? markTerm(strong, m[2]) : strong); span.appendChild(document.createTextNode(" " + m[0].toLowerCase()));
      meta.appendChild(span);
    });
    var bars = $("bars"); bars.textContent = "";
    Object.entries(r.probabilities).sort(function (a, b) { return b[1] - a[1]; }).forEach(function (entry) {
      var row = el("div", "bar-row" + (entry[0] === rec.shortlist[0] ? " on" : compare && entry[0] === rec.shortlist[1] ? " second" : ""));
      var desc = (config.roster.find(function (c) { return c.id === entry[0]; }) || {}).description || "";
      row.title = entry[0] + ": " + pct(entry[1], 1) + (desc ? "\\n" + desc : "");
      row.appendChild(el("span", "bar-label", entry[0]));
      var track = el("div", "track"), fill = el("div", "fill");
      track.appendChild(fill); row.appendChild(track);
      bars.appendChild(row);
      growBar(fill, entry[1]);
    });
    showLabelCheck(rec);
    if (CAN_RENDER) showRenderPlan(rec);
  }

  /** A pick's reasons, or what an unsure route is waiting to hear. Stays hidden when the checks don't back the pick. */
  function showReasons(explanation) {
    var box = $("reasons"), open = explanation.open.length > 0, shown = open ? explanation.open : explanation.because;
    box.textContent = ""; box.hidden = !shown.length;
    if (!shown.length) return;
    box.appendChild(el("span", "reasons-title", open ? "Say which applies to settle it" : "Why"));
    shown.forEach(function (reason, i) {
      box.appendChild(el("span", "reason" + (!open && i === 0 ? " deciding" : ""), reason.label + (open ? " · " + pct(reason.probability) : "")));
    });
  }

  /** The model a category routes to, named first, since the question is which model; categories without a local model name only the category. */
  function choiceModel(category) {
    var model = modelName(generatorOf(category)), box = el("span", "choice-model");
    box.appendChild(el("b", null, model || category));
    box.appendChild(el("span", null, model ? category : "no local model"));
    return box;
  }

  /** Animates a bar from empty, so every new route visibly fills in. */
  function growBar(fill, share) {
    fill.style.width = "0%";
    requestAnimationFrame(function () { requestAnimationFrame(function () { fill.style.width = pct(share, 1); }); });
  }

  function showRenderPlan(rec) {
    var shots = $("shots"); shots.textContent = "";
    rec.shortlist.filter(generatorOf).forEach(function (category) { shots.appendChild(makeShot(category, category)); });
    layoutShots();
    // A shortlisted category that uses the default model already renders the default's image, so there is nothing to add.
    var defaultShown = rec.shortlist.some(function (c) { return generatorOf(c) === config.defaultGenerator; });
    var compare = $("compare-default"), name = modelName(config.defaultGenerator);
    var topRenders = !!generatorOf(rec.shortlist[0]);
    compare.disabled = defaultShown || !topRenders;
    clearVerdict();
    compare.title = !topRenders ? "There is no local " + rec.shortlist[0] + " model to compare with " + name + "."
      : topPickIsDefault() ? "Routing already picked the default model, " + name + "."
      : defaultShown ? "The runner-up, " + rec.shortlist[1] + ", already uses the default model, " + name + "."
      : "Also render with " + name + ", the single model routing has to beat.";
    describeRender();
    showCachedImages(lastBrief, defaultShown);
  }

  function topPickIsDefault() { return generatorOf(lastRoute.recommendation.shortlist[0]) === config.defaultGenerator; }

  /** Puts already-rendered images on screen right after routing; only images never rendered need a click. */
  async function showCachedImages(brief, defaultShown) {
    var lookup = function (target) {
      return api("/api/cached-image", target === DEFAULT ? { brief: brief, default: true } : { brief: brief, category: target })
        .then(function (r) { return r.image; }, function () { return null; });
    };
    var shots = allShots();
    var images = await Promise.all(shots.map(function (s) { return lookup(s.dataset.target); }));
    var defaultImage = defaultShown ? null : await lookup(DEFAULT);
    if (brief !== lastBrief) return;
    shots.forEach(function (shot, i) { if (images[i] && pending(shot)) showImage(shot, images[i], "cached"); });
    // A comparison made before comes back with the brief.
    if (defaultImage && !hasDefaultShot()) showImage(addDefaultShot(), defaultImage, "cached");
    describeRender();
  }

  function showImage(shot, url, note) {
    var frame = shot.querySelector(".frame"); frame.textContent = "";
    var img = new Image(); img.alt = lastBrief; img.src = url; frame.appendChild(img);
    shot.dataset.image = url;
    shot.querySelector("code").textContent = modelName(generatorFor(shot.dataset.target)) + " · " + note;
  }

  function makeShot(target, label) {
    var g = generatorFor(target);
    var shot = el("div", "shot"); shot.dataset.target = target;
    var frame = el("div", "frame");
    frame.appendChild(el("div", "state", "Not rendered yet"));
    shot.appendChild(frame);
    var cap = el("div", "shot-caption"); cap.appendChild(el("span", null, label)); cap.appendChild(el("code", null, modelName(g)));
    shot.appendChild(cap);
    return shot;
  }

  function allShots() { return Array.prototype.slice.call(document.querySelectorAll("#shots .shot")); }
  function rendered(shot) { return !!shot.querySelector(".frame img"); }
  /** Waiting to render, or rendering: a second click must not queue it again. */
  function pending(shot) { return !rendered(shot) && shot.dataset.busy !== "1"; }

  function layoutShots() {
    $("shots").style.setProperty("--cols", allShots().length);
  }

  /**
   * The routed side of a judgment is the top pick. The default side is any other shot made by the default model,
   * which in compare mode can be the runner-up itself.
   */
  function judgedPair() {
    var shots = allShots();
    var routed = shots.find(function (s) { return s.dataset.target === lastRoute.recommendation.shortlist[0]; });
    var dflt = shots.find(function (s) { return s !== routed && generatorFor(s.dataset.target) === config.defaultGenerator; });
    return routed && dflt && routed.dataset.image && dflt.dataset.image ? { routed: routed, default: dflt } : null;
  }

  function updateJudgeButton() {
    var button = $("judge"), ready = lastRoute && judgedPair();
    button.disabled = !ready || button.dataset.busy === "1";
    button.title = ready ? "Ask Jev which of the two images fulfils the brief better, looking at both."
      : lastRoute && topPickIsDefault() ? "Routing picked the default model, so there is no pair to judge."
      : "Render the routed image and the default image first.";
  }

  function clearVerdict() {
    $("jev-verdict").style.display = "none";
    $("jev-verdict").textContent = "";
    allShots().forEach(function (s) { s.classList.remove("winner"); var tag = s.querySelector(".pick-tag"); if (tag) tag.remove(); });
  }

  async function judge() {
    var pair = judgedPair(), route = lastRoute;
    if (!pair) return;
    var button = $("judge"); button.dataset.busy = "1"; button.textContent = "Judging…"; updateJudgeButton();
    clearVerdict();
    var line = $("jev-verdict"), show;
    try {
      var v = await api("/api/judge", { brief: lastBrief, routed: pair.routed.dataset.image, default: pair.default.dataset.image });
      show = function () { showVerdict(line, v, pair); };
    } catch (e) {
      show = function () { line.appendChild(el("div", null, "Judging failed: " + e.message)); };
    }
    delete button.dataset.busy; button.textContent = "Judge with Jev"; updateJudgeButton();
    // Routing another brief meanwhile replaced the images this verdict is about.
    if (lastRoute !== route) return;
    show();
    line.style.display = "block";
  }

  function showVerdict(line, v, pair) {
    var names = { routed: modelName(generatorFor(pair.routed.dataset.target)), default: modelName(config.defaultGenerator) };
    var headline = el("div");
    if (v.winner === "tie") {
      headline.appendChild(el("strong", null, "Jev sees no clear winner"));
      headline.appendChild(document.createTextNode(" between " + names.routed + " (routed) and " + names.default + " (default)."));
    } else {
      headline.appendChild(el("strong", null, "Jev prefers " + names[v.winner]));
      headline.appendChild(document.createTextNode(v.winner === "routed" ? ", the routed pick." : ", the default model."));
      var shot = pair[v.winner];
      shot.classList.add("winner");
      shot.querySelector(".shot-caption span").appendChild(el("span", "pick-tag", "Jev's pick"));
    }
    var odds = el("div", "odds");
    [["routed", pct(v.probabilities.routed)], ["default", pct(v.probabilities.default)], ["tie", pct(v.probabilities.tie)],
     [v.model + (v.cached ? ", cached" : ""), Math.round(v.latencyMs) + " ms"], ["cost", "$" + v.costUsd.toFixed(4)]].forEach(function (o) {
      var item = el("span"); item.appendChild(el("b", null, o[1])); item.appendChild(document.createTextNode(" " + o[0]));
      odds.appendChild(item);
    });
    line.appendChild(headline); line.appendChild(odds);
  }

  function describeRender() {
    updateJudgeButton();
    var targets = allShots(), waiting = targets.filter(pending).length;
    var button = $("render");
    button.disabled = waiting === 0;
    button.textContent = waiting === 2 ? "Render both" : waiting > 2 ? "Render all" : "Render";
    var models = targets.map(function (s) { return modelName(generatorFor(s.dataset.target)); }).join(" and ");
    var missing = lastRoute.recommendation.shortlist.filter(function (c) { return !generatorOf(c); });
    var noLocal = missing.length ? "No local " + missing.join(" or ") + " model; routing still works, rendering needs a hosted one." : "";
    $("render-text").textContent = !targets.length ? noLocal
      : (waiting || targets.some(function (s) { return s.dataset.busy === "1"; })
        ? "Render locally with " + models + ". The first render of a model includes loading it."
        : "Rendered locally with " + models + ".") + (noLocal && " " + noLocal);
  }

  function hasDefaultShot() { return allShots().some(function (s) { return s.dataset.target === DEFAULT; }); }

  function addDefaultShot() {
    var shot = makeShot(DEFAULT, "default, no routing");
    $("shots").appendChild(shot);
    $("compare-default").disabled = true;
    layoutShots();
    return shot;
  }

  function compareWithDefault() {
    if (!lastRoute || hasDefaultShot()) return;
    addDefaultShot();
    describeRender();
    render();
  }

  async function render() {
    if (!lastRoute) return;
    var route = lastRoute, brief = lastBrief;
    var button = $("render"); button.disabled = true;
    // Images already on screen stay: adding the default model renders only the new shot.
    var targets = allShots().filter(pending);
    targets.forEach(function (s) { s.dataset.busy = "1"; setState(s, "Queued"); });
    // Routing another brief replaces the shots, so the rest of this queue belongs to a brief no longer on screen.
    for (var i = 0; i < targets.length && lastRoute === route; i++) {
      var shot = targets[i];
      try {
        var out = await renderShot(shot, brief);
        showImage(shot, out.image, out.cached ? "cached" : (out.latencyMs / 1000).toFixed(0) + "s");
      } catch (e) {
        setState(shot, "Render failed: " + e.message);
      }
      delete shot.dataset.busy;
    }
    describeRender();
  }

  // The model loads before the first denoising step, and the image is decoded and saved after the last one,
  // so the percentage covers the middle and the phases either side are named.
  async function renderShot(shot, brief) {
    var view = showRendering(shot), started = Date.now(), progress = null, out = null;
    function tick() {
      var elapsed = Math.round((Date.now() - started) / 1000) + "s";
      if (!progress) view.update("Loading model… " + elapsed, null);
      else if (progress.step < progress.total) view.update("Rendering " + pct(progress.step / progress.total) + " · " + elapsed, progress.step / progress.total);
      else view.update("Saving image… " + elapsed, 1);
    }
    tick();
    var timer = setInterval(tick, 500);
    try {
      var target = shot.dataset.target;
      await stream("/api/generate", target === DEFAULT ? { brief: brief, default: true } : { brief: brief, category: target }, function (event) {
        if (event.type === "progress") { progress = event; tick(); }
        else if (event.type === "done") out = event;
        else if (event.type === "error") throw new Error(event.error);
      });
    } finally {
      clearInterval(timer);
    }
    if (!out) throw new Error("the server ended the render without an image");
    return out;
  }

  // Built once per render: replacing the spinner on every tick would restart its rotation.
  function showRendering(shot) {
    var frame = shot.querySelector(".frame"); frame.textContent = "";
    var state = el("div", "state"), label = document.createTextNode(""), bar = el("div", "progress"), fill = el("div", "progress-fill");
    bar.appendChild(fill);
    state.appendChild(el("div", "spinner")); state.appendChild(label); state.appendChild(bar);
    frame.appendChild(state);
    return {
      update: function (text, fraction) {
        label.textContent = text;
        bar.classList.toggle("known", fraction != null);
        if (fraction != null) fill.style.width = pct(fraction, 1);
      },
    };
  }

  function setState(shot, text) {
    var frame = shot.querySelector(".frame"); frame.textContent = "";
    var state = el("div", "state");
    state.appendChild(document.createTextNode(text));
    frame.appendChild(state);
  }

  function renderEvidence() {
    var s = config.evidence.find(function (e) { return e.data === EVIDENCE_SET.data; });
    if (!s) {
      $("evidence-card").innerHTML = '<div class="empty">No eval run on the hard set yet. Run <kbd>npm run eval -- --repeats 3 --data ' + EVIDENCE_SET.data + '</kbd> and reload to see accuracy and calibration here.</div>';
      return;
    }
    $("set-about").textContent = EVIDENCE_SET.about + " " + s.n + " briefs, each routed " + s.repeats + " times.";
    var card = $("evidence-card"); card.textContent = "";
    card.appendChild(el("p", "evidence-headline", evidenceHeadline(s.outcomes)));
    card.appendChild(outcomeTiles(s.outcomes, s.n * s.repeats));
    card.appendChild(moreNumbers(s));
  }

  function seconds(ms) { return (ms / 1000).toFixed(2) + " s"; }

  /** Everything past the headline and the two outcomes, folded away: the outcomes are the claim, these are its fine print. */
  function moreNumbers(s) {
    var details = el("details"); details.appendChild(el("summary", null, "More numbers"));
    var stats = el("div", "stats");
    [
      ["Right overall", pct(s.metrics.accuracy), "first pick matched the label", null],
      ["Calibration error", s.metrics.ece.toFixed(2), "lower is better", "ece"],
      ["Speed", seconds(s.latencyP50), "95% within " + seconds(s.latencyP95), "latency"],
      ["Cost", "$" + s.costPer1000Usd.toFixed(3), "per 1,000 decisions", "cost"]
    ].forEach(function (t) { stats.appendChild(tile(t[3] ? term(t[0], t[3]) : t[0], t[1], t[2])); });
    details.appendChild(stats);
    var foot = el("p", "evidence-foot");
    foot.appendChild(document.createTextNode("Decided by "));
    foot.appendChild(term("Jev", "jev"));
    foot.appendChild(document.createTextNode(" "));
    foot.appendChild(markTerm(el("b", null, s.model), "version"));
    foot.appendChild(document.createTextNode(" using the "));
    foot.appendChild(markTerm(el("b", null, s.variant), "variant"));
    foot.appendChild(document.createTextNode(" wording."));
    details.appendChild(foot);
    details.appendChild(reliabilityChart(s.bins));
    details.appendChild(binTable(s.bins));
    return details;
  }

  /** The takeaway in one or two sentences, worded from the numbers so it can't overclaim. */
  function evidenceHeadline(o) {
    var parts = [];
    if (o.picked) {
      parts.push(o.pickedRight === o.picked
        ? "When Typecast was sure enough to pick a model, it was right every time."
        : "When Typecast was sure enough to pick a model, it was right " + pct(o.pickedRight / o.picked) + " of the time.");
    }
    if (o.compared) parts.push("When it wasn't, the right model was one of the two it showed in " + o.comparedInShortlist + " of " + o.compared + " cases.");
    return parts.join(" ");
  }

  function outcomeTiles(o, routes) {
    var wrap = el("div", "outcomes");
    [
      ["pick", "Picked for you", o.pickedRight, o.picked, "right",
        [o.picked + " of " + routes + " ", term("routes", "route"), ". Jev was ", term(pct(config.pickThreshold) + "+ sure", "confidence"), ", so the UI used its pick without asking."]],
      ["compare", "Shown side by side", o.comparedInShortlist, o.compared, "had the right model in the pair",
        [o.compared + " of " + routes + " ", term("routes", "route"), ". Jev was ", term("less sure", "confidence"), ", so the UI showed its top two and let the user choose."]]
    ].forEach(function (t) {
      var box = el("div", "outcome");
      var badge = el("span", "badge " + t[0]); badge.innerHTML = ICONS[t[0]]; badge.appendChild(document.createTextNode(t[1]));
      box.appendChild(badge);
      var value = el("div", "value", t[3] ? pct(t[2] / t[3]) : "None");
      if (t[3]) value.appendChild(el("span", null, t[4]));
      box.appendChild(value);
      var p = el("p");
      t[5].forEach(function (part) { p.appendChild(typeof part === "string" ? document.createTextNode(part) : part); });
      box.appendChild(p);
      wrap.appendChild(box);
    });
    return wrap;
  }

  function tile(label, value, sub) {
    var t = el("div", "tile"), l = el("div", "label");
    l.appendChild(typeof label === "string" ? document.createTextNode(label) : label);
    t.appendChild(l); t.appendChild(el("div", "value", value)); t.appendChild(el("div", "sub", sub));
    return t;
  }

  function reliabilityChart(bins) {
    var wrap = el("div", "chart");
    wrap.appendChild(el("p", null, "Routes grouped by how sure Jev was. Bar height is how often each group was right; the number on top is how many routes it holds. A bar that reaches the dashed line means Jev was exactly as sure as it should have been."));
    var W = 360, H = 240, L = 34, R = 8, T = 8, B = 26, iw = W - L - R, ih = H - T - B;
    var x = function (v) { return L + v * iw; }, y = function (v) { return T + (1 - v) * ih; };
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg"); svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Reliability diagram: accuracy per confidence band");
    function add(parent, tag, attrs) { var n = document.createElementNS(ns, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); parent.appendChild(n); return n; }
    var grid = add(svg, "g", { class: "grid" }), axis = add(svg, "g", { class: "axis" });
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      add(grid, "line", { x1: L, x2: W - R, y1: y(v), y2: y(v) });
      var t = add(axis, "text", { x: L - 6, y: y(v) + 4, "text-anchor": "end" }); t.textContent = pct(v);
    });
    [0, 0.5, 1].forEach(function (v) { var t = add(axis, "text", { x: x(v), y: H - 6, "text-anchor": v === 0 ? "start" : v === 1 ? "end" : "middle" }); t.textContent = pct(v); });
    var tooltip = $("tooltip"), counts = add(svg, "g", {});
    bins.forEach(function (b) {
      if (!b.count) return;
      var gap = 2, bx = x(b.lo) + gap / 2, bw = x(b.hi) - x(b.lo) - gap, top = y(b.accuracy), h = Math.max(y(0) - top, 0);
      var r = Math.min(4, bw / 2, h);
      var path = "M" + bx + "," + y(0) + "V" + (top + r) + "Q" + bx + "," + top + " " + (bx + r) + "," + top + "H" + (bx + bw - r) + "Q" + (bx + bw) + "," + top + " " + (bx + bw) + "," + (top + r) + "V" + y(0) + "Z";
      var bar = add(svg, "path", { d: path, fill: "var(--accent)" });
      var count = add(counts, "text", { x: bx + bw / 2, y: top - 5, "text-anchor": "middle", class: "count" }); count.textContent = b.count;
      var hit = add(svg, "rect", { x: x(b.lo), y: T, width: x(b.hi) - x(b.lo), height: ih, fill: "transparent" });
      hit.addEventListener("mousemove", function (e) {
        tooltip.textContent = "Confidence " + pct(b.lo) + "–" + pct(b.hi) + ": " + pct(b.accuracy, 1) + " right, n=" + b.count;
        tooltip.style.opacity = 1;
        tooltip.style.left = Math.min(e.clientX + 12, window.innerWidth - tooltip.offsetWidth - 8) + "px";
        tooltip.style.top = (e.clientY + window.scrollY + 14) + "px";
        bar.setAttribute("fill-opacity", "0.8");
      });
      hit.addEventListener("mouseleave", function () { tooltip.style.opacity = 0; bar.removeAttribute("fill-opacity"); });
    });
    add(svg, "line", { x1: x(0), y1: y(0), x2: x(1), y2: y(1), stroke: "var(--muted)", "stroke-width": 1.5, "stroke-dasharray": "4 4" });
    add(svg, "line", { x1: L, x2: W - R, y1: y(0), y2: y(0), stroke: "var(--muted)", "stroke-width": 1 });
    // Counts go last so the dashed diagonal never draws over one.
    svg.appendChild(counts);
    wrap.appendChild(svg);
    return wrap;
  }

  function binTable(bins) {
    var table = el("table"), head = el("tr");
    ["How sure", "Routes", "Said on average", "Was right"].forEach(function (h) { head.appendChild(el("th", null, h)); });
    table.appendChild(head);
    bins.filter(function (b) { return b.count; }).forEach(function (b) {
      var tr = el("tr");
      [pct(b.lo) + "–" + pct(b.hi), b.count, pct(b.avgConfidence, 1), pct(b.accuracy, 1)].forEach(function (v) { tr.appendChild(el("td", null, String(v))); });
      table.appendChild(tr);
    });
    return table;
  }

  $("route").addEventListener("click", route);
  $("more-examples").addEventListener("click", function () { examplesShown += EXAMPLES_PAGE; renderExamples(); });
  $("render").addEventListener("click", render);
  $("compare-default").addEventListener("click", compareWithDefault);
  $("judge").addEventListener("click", judge);
  $("brief").addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); route(); } });
  init().catch(function (e) { $("error").textContent = e.message; });
</script>
</body>
</html>
`;
