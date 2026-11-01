// The demo page. Self-contained: no build step, no external assets, works offline.
// Page script avoids template literals so this file can stay one template string.
export const DEMO_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Typecast</title>
<style>
  :root {
    color-scheme: light;
    --bg: #f4f4f1; --surface: #fcfcfb; --surface-2: #f0efec; --line: #e2e1dc;
    --text: #0b0b0b; --text-2: #52514e; --muted: #7c7b76;
    --accent: #2a78d6; --accent-soft: #cde2fb; --track: #ebeae6; --bar-rest: #c9c8c2;
    --good: #0ca30c; --good-text: #006300; --good-bg: #e3f4e3;
    --warn: #fab219; --warn-text: #7a4f00; --warn-bg: #fdf1d6;
    --danger: #d03b3b;
    --shadow: 0 1px 2px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.04);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --bg: #121211; --surface: #1a1a19; --surface-2: #232321; --line: #2f2f2c;
      --text: #f0efec; --text-2: #c3c2b7; --muted: #8e8d86;
      --accent: #3987e5; --accent-soft: #1c3557; --track: #2a2a27; --bar-rest: #4a4a45;
      --good-text: #5fd35f; --good-bg: #16301a; --warn-text: #fbc756; --warn-bg: #3a2e12;
      --shadow: none;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --bg: #121211; --surface: #1a1a19; --surface-2: #232321; --line: #2f2f2c;
    --text: #f0efec; --text-2: #c3c2b7; --muted: #8e8d86;
    --accent: #3987e5; --accent-soft: #1c3557; --track: #2a2a27; --bar-rest: #4a4a45;
    --good-text: #5fd35f; --good-bg: #16301a; --warn-text: #fbc756; --warn-bg: #3a2e12;
    --shadow: none;
  }
  * { box-sizing: border-box; }
  html { background: var(--bg); }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }
  header.top { padding: 40px 0 28px; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 650; font-size: 17px; letter-spacing: -0.01em; }
  .brand-mark { width: 22px; height: 22px; border-radius: 6px; background: var(--text); color: var(--bg); display: grid; place-items: center; font-size: 13px; font-weight: 700; }
  h1 { margin: 20px 0 8px; font-size: 34px; line-height: 1.15; letter-spacing: -0.025em; font-weight: 650; max-width: 22ch; text-wrap: balance; }
  .lede { margin: 0; color: var(--text-2); font-size: 16px; max-width: 62ch; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow); }
  .composer { padding: 16px; }
  textarea { width: 100%; min-height: 84px; resize: vertical; border: 0; outline: 0; background: transparent; color: var(--text); font: inherit; font-size: 17px; line-height: 1.5; padding: 4px 4px 8px; }
  textarea::placeholder { color: var(--muted); }
  .composer-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 12px; border-top: 1px solid var(--line); }
  .hint { color: var(--muted); font-size: 13px; }
  kbd { font: 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; padding: 2px 5px; border: 1px solid var(--line); border-radius: 4px; background: var(--surface-2); }
  button { font: inherit; font-weight: 550; border-radius: 9px; padding: 9px 16px; cursor: pointer; border: 1px solid var(--line); background: var(--surface); color: var(--text); transition: background .12s, border-color .12s, opacity .12s; }
  button:hover:not(:disabled) { border-color: var(--muted); }
  button:focus-visible, textarea:focus-visible, .chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  button:disabled { opacity: .45; cursor: default; }
  button.primary { background: var(--text); color: var(--bg); border-color: var(--text); }
  button.primary:hover:not(:disabled) { opacity: .88; border-color: var(--text); }
  .examples { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 0; }
  .chip { font-size: 13px; font-weight: 450; color: var(--text-2); padding: 6px 11px; border-radius: 999px; background: transparent; border: 1px solid var(--line); max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chip:hover:not(:disabled) { color: var(--text); }
  section { margin-top: 28px; }
  .section-title { font-size: 12px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin: 0 0 12px; }
  #result { display: none; }
  .result-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); }
  .verdict { padding: 24px; border-right: 1px solid var(--line); display: flex; flex-direction: column; gap: 14px; }
  .badge { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding: 4px 10px 4px 8px; border-radius: 999px; }
  .badge svg { width: 14px; height: 14px; }
  .badge.pick { color: var(--good-text); background: var(--good-bg); }
  .badge.compare { color: var(--warn-text); background: var(--warn-bg); }
  .choice { font-size: 30px; font-weight: 650; letter-spacing: -0.02em; line-height: 1.1; }
  .choice .vs { color: var(--muted); font-weight: 500; font-size: 20px; margin: 0 6px; }
  .confidence { display: flex; align-items: baseline; gap: 8px; }
  .confidence b { font-size: 44px; font-weight: 650; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; line-height: 1; }
  .confidence span { color: var(--text-2); }
  .explain { color: var(--text-2); margin: 0; font-size: 14px; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 16px; color: var(--muted); font-size: 13px; margin-top: auto; padding-top: 8px; font-variant-numeric: tabular-nums; }
  .meta strong { color: var(--text-2); font-weight: 550; }
  .bars { padding: 24px; }
  .bars-title { margin: 0 0 6px; font-size: 13px; font-weight: 550; color: var(--text-2); }
  .bar-row { display: grid; grid-template-columns: 112px minmax(0, 1fr) 48px; align-items: center; gap: 12px; padding: 7px 0; }
  .bar-label { font-size: 14px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar-row.on .bar-label { color: var(--text); font-weight: 600; }
  .track { position: relative; height: 10px; background: var(--track); border-radius: 5px; }
  .fill { position: absolute; inset: 0 auto 0 0; border-radius: 5px; background: var(--bar-rest); transition: width .5s cubic-bezier(.2,.8,.2,1); }
  .bar-row.on .fill { background: var(--accent); }
  .bar-row.second .fill { background: var(--accent-soft); }
  .threshold { position: absolute; top: -5px; bottom: -5px; width: 0; border-left: 1.5px dashed var(--muted); }
  .bar-value { text-align: right; font-size: 13px; font-variant-numeric: tabular-nums; color: var(--text-2); }
  .bar-row.on .bar-value { color: var(--text); font-weight: 600; }
  .bars-foot { display: flex; align-items: center; gap: 8px; margin-top: 10px; color: var(--muted); font-size: 12px; }
  .bars-note { margin: 6px 0 0; color: var(--muted); font-size: 12px; }
  .bars-foot i { width: 0; height: 12px; border-left: 1.5px dashed var(--muted); }
  .render { border-top: 1px solid var(--line); padding: 24px; }
  .render-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
  .render-head p { margin: 0; color: var(--text-2); font-size: 14px; }
  .shots { display: grid; gap: 16px; grid-template-columns: repeat(var(--cols, 1), minmax(0, 1fr)); }
  .shots.single { max-width: 520px; }
  .shot { display: flex; flex-direction: column; gap: 8px; }
  .frame { aspect-ratio: 1; border-radius: 10px; background: var(--surface-2); overflow: hidden; display: grid; place-items: center; position: relative; }
  .frame img { width: 100%; height: 100%; object-fit: cover; display: block; animation: fade .4s ease; }
  @keyframes fade { from { opacity: 0; } }
  .frame .state { color: var(--muted); font-size: 13px; text-align: center; padding: 16px; font-variant-numeric: tabular-nums; }
  .spinner { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--line); border-top-color: var(--text-2); animation: spin .8s linear infinite; margin: 0 auto 10px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .progress { width: 140px; height: 3px; margin: 10px auto 0; border-radius: 2px; background: var(--track); overflow: hidden; visibility: hidden; }
  .progress.known { visibility: visible; }
  .progress-fill { height: 100%; width: 0; background: var(--accent); transition: width .3s ease; }
  .shot-caption { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; color: var(--text-2); }
  .shot-caption code { font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--muted); }
  .evidence-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
  .evidence-head .section-title { margin: 0; }
  .segmented { display: inline-flex; padding: 3px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; gap: 2px; }
  .segmented button { border: 0; background: transparent; padding: 5px 12px; font-size: 13px; color: var(--text-2); border-radius: 7px; }
  .segmented button[aria-pressed="true"] { background: var(--surface); color: var(--text); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
  .evidence-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .tiles { display: grid; grid-template-columns: 1fr 1fr; padding: 8px; gap: 0; border-right: 1px solid var(--line); align-content: start; }
  .tile { padding: 16px; }
  .tile .label { font-size: 13px; color: var(--text-2); }
  .tile .value { font-size: 26px; font-weight: 650; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; margin-top: 2px; }
  .tile .sub { font-size: 12px; color: var(--muted); }
  .chart { padding: 20px 24px; position: relative; }
  .chart h3 { margin: 0; font-size: 14px; font-weight: 600; }
  .chart p { margin: 2px 0 8px; font-size: 13px; color: var(--muted); }
  .chart svg { display: block; width: 100%; height: auto; overflow: visible; }
  .chart .axis text { fill: var(--muted); font-size: 11px; }
  .chart .grid line { stroke: var(--line); }
  .chart .count { fill: var(--muted); font-size: 10px; font-variant-numeric: tabular-nums; }
  .tooltip { position: absolute; pointer-events: none; background: var(--text); color: var(--bg); font-size: 12px; padding: 6px 9px; border-radius: 7px; white-space: nowrap; opacity: 0; transition: opacity .1s; font-variant-numeric: tabular-nums; }
  details { padding: 0 24px 20px; color: var(--text-2); font-size: 13px; }
  summary { cursor: pointer; color: var(--muted); }
  table { border-collapse: collapse; margin-top: 8px; font-variant-numeric: tabular-nums; }
  th, td { text-align: right; padding: 4px 12px 4px 0; }
  th { font-weight: 550; color: var(--muted); }
  .empty { padding: 24px; color: var(--muted); font-size: 14px; }
  #error { color: var(--danger); font-size: 14px; margin: 12px 0 0; min-height: 0; }
  footer { color: var(--muted); font-size: 13px; padding: 40px 0 48px; }
  @media (max-width: 760px) {
    .wrap { padding: 0 16px; }
    header.top { padding: 28px 0 20px; }
    h1 { font-size: 27px; }
    .result-grid, .evidence-grid { grid-template-columns: 1fr; }
    .verdict { border-right: 0; border-bottom: 1px solid var(--line); }
    .tiles { border-right: 0; border-bottom: 1px solid var(--line); }
    .shots { grid-template-columns: 1fr; }
    .hint { display: none; }
    .bar-row { grid-template-columns: 96px minmax(0, 1fr) 44px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div class="brand"><span class="brand-mark">T</span>Typecast</div>
    <h1>Which image model should make this?</h1>
    <p class="lede">Describe what you want. A decision model picks the model category in about 200ms, and its confidence says whether to just pick or to show the top two side by side.</p>
  </header>

  <div class="card composer">
    <textarea id="brief" placeholder="e.g. Hero image for a spring sneaker campaign, shoe floating on a pastel backdrop" aria-label="Creative brief"></textarea>
    <div class="composer-foot">
      <span class="hint"><kbd>⌘</kbd> <kbd>↵</kbd> to route</span>
      <button class="primary" id="route">Route brief</button>
    </div>
  </div>
  <div class="examples" id="examples"></div>
  <p id="error" role="alert"></p>

  <section id="result" aria-live="polite">
    <h2 class="section-title">Routing</h2>
    <div class="card">
      <div class="result-grid">
        <div class="verdict">
          <span class="badge" id="badge"></span>
          <div class="choice" id="choice"></div>
          <div class="confidence"><b id="confidence"></b><span>confidence</span></div>
          <p class="explain" id="explain"></p>
          <div class="meta" id="meta"></div>
        </div>
        <div class="bars">
          <h3 class="bars-title">Probability per category</h3>
          <div id="bars"></div>
          <div class="bars-foot"><i></i><span id="threshold-label"></span></div>
          <p class="bars-note">The decision model reports its confidence separately from these probabilities, so the two can differ by a few points.</p>
        </div>
      </div>
      <div class="render">
        <div class="render-head"><p id="render-text"></p><button id="render">Render</button></div>
        <div class="shots" id="shots"></div>
      </div>
    </div>
  </section>

  <section id="evidence">
    <div class="evidence-head">
      <h2 class="section-title">Why trust the confidence</h2>
      <div class="segmented" id="sets" role="group" aria-label="Brief set"></div>
    </div>
    <div class="card" id="evidence-card"></div>
  </section>

  <footer>Runs locally. Routing calls the Jev decision API; images render on this Mac with mflux.</footer>
</div>
<div class="tooltip" id="tooltip"></div>

<script>
  var $ = function (id) { return document.getElementById(id); };
  var config = null, lastRoute = null, lastBrief = "", busy = false;
  var ICONS = {
    pick: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>',
    compare: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="2" y="3" width="5" height="10" rx="1.2"/><rect x="9" y="3" width="5" height="10" rx="1.2"/></svg>'
  };
  var SET_NAMES = { "data/dev.jsonl": "Dev", "data/test.jsonl": "Test (held out)", "data/hard.jsonl": "Hard (held out)" };

  function pct(x, digits) { return (x * 100).toFixed(digits == null ? 0 : digits) + "%"; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function generatorOf(id) { var r = config.roster.find(function (c) { return c.id === id; }); return r && r.generator; }
  function modelName(g) { return g ? g.replace(/^mflux:/, "").replace(/@q\\d+$/, "") : null; }

  async function api(path, body) {
    var res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  }

  /** POSTs and calls onEvent for each line of the NDJSON reply as it arrives. */
  async function stream(path, body, onEvent) {
    var res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { var data = await res.json().catch(function () { return {}; }); throw new Error(data.error || res.statusText); }
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
    config.examples.forEach(function (text) {
      var chip = el("button", "chip", text);
      chip.title = text;
      chip.addEventListener("click", function () { $("brief").value = text; route(); });
      $("examples").appendChild(chip);
    });
    $("threshold-label").textContent = "Pick line at " + pct(config.pickThreshold) + ". Below it, compare the top two.";
    renderEvidence();
  }

  async function route() {
    var brief = $("brief").value.trim();
    if (!brief || busy) return;
    busy = true; $("route").disabled = true; $("route").textContent = "Routing…"; $("error").textContent = "";
    try {
      lastRoute = await api("/api/route", { brief: brief });
      lastBrief = brief;
      showRoute(lastRoute);
      $("result").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      $("error").textContent = e.message;
    } finally {
      busy = false; $("route").disabled = false; $("route").textContent = "Route brief";
    }
  }

  function showRoute(r) {
    var rec = r.recommendation, compare = rec.mode === "compare";
    $("result").style.display = "block";
    var badge = $("badge");
    badge.className = "badge " + rec.mode;
    badge.innerHTML = ICONS[rec.mode] + (compare ? "Unsure: compare two" : "Confident: just pick");
    var choice = $("choice"); choice.textContent = "";
    choice.appendChild(document.createTextNode(rec.shortlist[0]));
    if (compare) { choice.appendChild(el("span", "vs", "or")); choice.appendChild(document.createTextNode(rec.shortlist[1])); }
    $("confidence").textContent = pct(r.confidence);
    $("explain").textContent = compare
      ? "Below the " + pct(config.pickThreshold) + " pick line, so the UI should render both and let the user choose."
      : "At or above the " + pct(config.pickThreshold) + " pick line, so the UI can use this model without asking.";
    var meta = $("meta"); meta.textContent = "";
    [["Latency", Math.round(r.latencyMs) + " ms"], ["Cost", "$" + r.costUsd.toFixed(6)], ["Model", r.model]].forEach(function (m) {
      var span = el("span"); span.appendChild(el("strong", null, m[1])); span.appendChild(document.createTextNode(" " + m[0].toLowerCase()));
      meta.appendChild(span);
    });
    var bars = $("bars"); bars.textContent = "";
    Object.entries(r.probabilities).sort(function (a, b) { return b[1] - a[1]; }).forEach(function (entry) {
      var row = el("div", "bar-row" + (entry[0] === rec.shortlist[0] ? " on" : compare && entry[0] === rec.shortlist[1] ? " second" : ""));
      var desc = (config.roster.find(function (c) { return c.id === entry[0]; }) || {}).description || "";
      row.title = entry[0] + ": " + pct(entry[1], 1) + (desc ? "\\n" + desc : "");
      row.appendChild(el("span", "bar-label", entry[0]));
      var track = el("div", "track"), fill = el("div", "fill"), mark = el("div", "threshold");
      fill.style.width = "0%"; mark.style.left = pct(config.pickThreshold, 1);
      track.appendChild(fill); track.appendChild(mark); row.appendChild(track);
      row.appendChild(el("span", "bar-value", pct(entry[1])));
      bars.appendChild(row);
      requestAnimationFrame(function () { requestAnimationFrame(function () { fill.style.width = pct(entry[1], 1); }); });
    });
    showRenderPlan(rec);
  }

  function showRenderPlan(rec) {
    var renderable = rec.shortlist.filter(generatorOf);
    var shots = $("shots"); shots.textContent = "";
    shots.className = "shots" + (rec.shortlist.length === 1 ? " single" : "");
    shots.style.setProperty("--cols", rec.shortlist.length);
    rec.shortlist.forEach(function (category) {
      var g = generatorOf(category);
      var shot = el("div", "shot"); shot.dataset.category = category;
      var frame = el("div", "frame");
      frame.appendChild(el("div", "state", g ? "Not rendered yet" : "No local " + category + " model. Routing still works; rendering needs a hosted model."));
      shot.appendChild(frame);
      var cap = el("div", "shot-caption"); cap.appendChild(el("span", null, category)); cap.appendChild(el("code", null, modelName(g) || "none"));
      shot.appendChild(cap);
      shots.appendChild(shot);
    });
    var button = $("render");
    button.disabled = renderable.length === 0;
    button.textContent = renderable.length > 1 ? "Render both" : "Render";
    $("render-text").textContent = renderable.length
      ? "Render locally with " + renderable.map(function (c) { return modelName(generatorOf(c)); }).join(" and ") + ". The first render of a model includes loading it."
      : "Nothing to render locally for this route.";
  }

  async function render() {
    if (!lastRoute) return;
    var button = $("render"); button.disabled = true;
    var targets = Array.prototype.slice.call(document.querySelectorAll("#shots .shot")).filter(function (s) { return generatorOf(s.dataset.category); });
    targets.forEach(function (s) { setState(s, "Queued"); });
    for (var i = 0; i < targets.length; i++) {
      var shot = targets[i];
      try {
        var out = await renderShot(shot);
        var frame = shot.querySelector(".frame"); frame.textContent = "";
        var img = new Image(); img.alt = lastBrief; img.src = out.image; frame.appendChild(img);
        shot.querySelector("code").textContent = modelName(out.generator) + " · " + (out.cached ? "cached" : (out.latencyMs / 1000).toFixed(0) + "s");
      } catch (e) {
        setState(shot, "Render failed: " + e.message);
      }
    }
    button.disabled = false;
  }

  // The model loads before the first denoising step, and the image is decoded and saved after the last one,
  // so the percentage covers the middle and the phases either side are named.
  async function renderShot(shot) {
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
      await stream("/api/generate", { brief: lastBrief, category: shot.dataset.category }, function (event) {
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

  var currentSet = null;
  function renderEvidence() {
    var ORDER = ["data/dev.jsonl", "data/test.jsonl", "data/hard.jsonl"];
    var rank = function (s) { var i = ORDER.indexOf(s.data); return i < 0 ? ORDER.length : i; };
    var sets = config.evidence.slice().sort(function (a, b) { return rank(a) - rank(b); });
    if (!sets.length) {
      $("evidence-card").innerHTML = '<div class="empty">No eval runs yet. Run <kbd>npm run eval -- --repeats 3</kbd> and reload to see accuracy and calibration here.</div>';
      return;
    }
    var preferred = sets.find(function (s) { return s.data === "data/hard.jsonl"; }) || sets[0];
    currentSet = currentSet || preferred.data;
    var group = $("sets"); group.textContent = "";
    sets.forEach(function (s) {
      var b = el("button", null, SET_NAMES[s.data] || s.data);
      b.setAttribute("aria-pressed", String(s.data === currentSet));
      b.addEventListener("click", function () { currentSet = s.data; renderEvidence(); });
      group.appendChild(b);
    });
    var s = sets.find(function (x) { return x.data === currentSet; });
    var card = $("evidence-card"); card.textContent = "";
    var grid = el("div", "evidence-grid"), tiles = el("div", "tiles");
    var m = s.metrics;
    [
      ["Accuracy", pct(m.accuracy, 1), s.n + " briefs × " + s.repeats + " runs"],
      ["Calibration error", m.ece.toFixed(3), "ECE, lower is better"],
      ["Confident misses", String(+m.confidentMissesPerRepeat.toFixed(1)), "wrong at ≥ " + pct(config.pickThreshold) + ", per run"],
      ["Latency", Math.round(s.latencyP50) + " ms", "p95 " + Math.round(s.latencyP95) + " ms"],
      ["Cost", "$" + s.costPer1000Usd.toFixed(3), "per 1,000 routes"],
      ["Model", s.model, "variant " + s.variant]
    ].forEach(function (t) {
      var tile = el("div", "tile"); tile.appendChild(el("div", "label", t[0])); tile.appendChild(el("div", "value", t[1])); tile.appendChild(el("div", "sub", t[2]));
      tiles.appendChild(tile);
    });
    grid.appendChild(tiles);
    grid.appendChild(reliabilityChart(s.bins));
    card.appendChild(grid);
    card.appendChild(binTable(s.bins));
  }

  function reliabilityChart(bins) {
    var wrap = el("div", "chart");
    wrap.appendChild(el("h3", null, "Reliability"));
    wrap.appendChild(el("p", null, "Accuracy within each confidence band, with the number of routes above each bar. On the dashed line, confidence means exactly what it says."));
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
    var tooltip = $("tooltip");
    bins.forEach(function (b) {
      if (!b.count) return;
      var gap = 2, bx = x(b.lo) + gap / 2, bw = x(b.hi) - x(b.lo) - gap, top = y(b.accuracy), h = Math.max(y(0) - top, 0);
      var r = Math.min(4, bw / 2, h);
      var path = "M" + bx + "," + y(0) + "V" + (top + r) + "Q" + bx + "," + top + " " + (bx + r) + "," + top + "H" + (bx + bw - r) + "Q" + (bx + bw) + "," + top + " " + (bx + bw) + "," + (top + r) + "V" + y(0) + "Z";
      var bar = add(svg, "path", { d: path, fill: "var(--accent)" });
      var count = add(svg, "text", { x: bx + bw / 2, y: top - 5, "text-anchor": "middle", class: "count" }); count.textContent = b.count;
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
    wrap.appendChild(svg);
    return wrap;
  }

  function binTable(bins) {
    var details = el("details"); details.appendChild(el("summary", null, "Show as table"));
    var table = el("table"), head = el("tr");
    ["Confidence band", "Briefs", "Avg confidence", "Accuracy"].forEach(function (h) { head.appendChild(el("th", null, h)); });
    table.appendChild(head);
    bins.filter(function (b) { return b.count; }).forEach(function (b) {
      var tr = el("tr");
      [pct(b.lo) + "–" + pct(b.hi), b.count, pct(b.avgConfidence, 1), pct(b.accuracy, 1)].forEach(function (v) { tr.appendChild(el("td", null, String(v))); });
      table.appendChild(tr);
    });
    details.appendChild(table);
    return details;
  }

  $("route").addEventListener("click", route);
  $("render").addEventListener("click", render);
  $("brief").addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); route(); } });
  init().catch(function (e) { $("error").textContent = e.message; });
</script>
</body>
</html>
`;
