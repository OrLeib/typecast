// The "Find and crop" demo page: pick an image, name a target, and Jev boxes it; the page shows the box and a square
// crop centred on it.
// Page script avoids template literals so this file can stay one template string.
import { FAVICON_LINK } from "../shared/brand.ts";
import { DEFAULT_TARGET } from "./locate-api.ts";
import { BASE_STYLE, pageNav } from "./page-style.ts";

export const locatePage = ({ hosted }: { hosted: boolean }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Typecast: find and crop</title>
${FAVICON_LINK}
<style>
${BASE_STYLE}
  .locate-grid { display: grid; grid-template-columns: 280px minmax(0, 1fr); }
  .controls { padding: 20px; border-right: 1px solid var(--line); display: flex; flex-direction: column; gap: 16px; }
  .field { display: grid; gap: 6px; }
  .field-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .field-label { font-size: 13px; font-weight: 550; color: var(--text-2); }
  .samples { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .sample { padding: 0; border-radius: 9px; overflow: hidden; aspect-ratio: 1; border: 2px solid transparent; background: var(--surface-2); }
  .sample img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .sample[aria-pressed="true"] { border-color: var(--accent); }
  .upload { margin-top: 2px; padding: 9px 12px; border: 1px dashed var(--line); border-radius: 9px; text-align: center; font-size: 13px; color: var(--text-2); cursor: pointer; }
  .upload:hover { border-color: var(--muted); }
  .upload:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
  .upload input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  input[type=text] { width: 100%; padding: 9px 11px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface); color: var(--text); font: inherit; }
  input[type=text]:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .field-head output { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
  input[type=range] { width: 100%; accent-color: var(--accent); margin: 0; }
  .stage-wrap { padding: 20px; display: grid; place-items: center; min-height: 420px; background: var(--surface-2); border-radius: 0 14px 0 0; }
  /* Clips the crop mark's dimming shadow to the photo. */
  .stage { position: relative; line-height: 0; max-width: 100%; overflow: hidden; border-radius: 8px; }
  .stage img { max-width: 100%; max-height: 62vh; display: block; }
  .mark { position: absolute; pointer-events: none; border-radius: 3px; }
  #box-mark { border: 2px solid var(--accent); box-shadow: 0 0 0 1px rgba(0,0,0,.35); }
  #crop-mark { border: 2px dashed #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.45), 0 0 0 9999px rgba(0,0,0,.28); }
  .stage-empty { color: var(--muted); font-size: 14px; }
  .legend { display: flex; gap: 18px; padding: 12px 20px; border-top: 1px solid var(--line); font-size: 13px; color: var(--text-2); }
  .legend span::before { content: ""; display: inline-block; width: 16px; height: 0; margin-right: 7px; vertical-align: middle; border-top: 2px solid var(--accent); }
  .legend span.crop::before { border-top: 2px dashed var(--text-2); }
  #result-section { display: none; }
  .result { display: grid; grid-template-columns: 260px minmax(0, 1fr); }
  .crop-frame { padding: 20px; border-right: 1px solid var(--line); }
  .crop-frame img { width: 100%; aspect-ratio: 1; border-radius: 10px; display: block; background: var(--surface-2); }
  .crop-frame p { margin: 8px 0 0; font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .result.absent .crop-frame img { opacity: .35; filter: grayscale(1); }
  .readout { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
  .scores { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; max-width: 460px; }
  .score { padding: 14px 16px; border-radius: 12px; background: var(--surface-2); }
  .score .label { font-size: 13px; color: var(--text-2); }
  .score .value { font-size: 30px; font-weight: 650; letter-spacing: -0.02em; line-height: 1.15; font-variant-numeric: tabular-nums; }
  .score p { margin: 4px 0 0; font-size: 12px; color: var(--muted); }
  .absent-note { display: none; margin: 0; padding: 10px 12px; border-radius: 10px; font-size: 14px; color: var(--warn-text); background: var(--warn-bg); }
  .result.absent .absent-note { display: block; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 16px; color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
  .meta strong { color: var(--text-2); font-weight: 550; }
  .why { margin: 0; font-size: 14px; color: var(--text-2); max-width: 62ch; }
  #error { color: var(--danger); font-size: 14px; margin: 12px 0 0; }
  @media (max-width: 760px) {
    .locate-grid, .result { grid-template-columns: 1fr; }
    .controls, .crop-frame { border-right: 0; border-bottom: 1px solid var(--line); }
    .stage-wrap { border-radius: 0; min-height: 260px; }
    .crop-frame img { max-width: 260px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    ${pageNav("locate")}
    <h1>Where is it in the image?</h1>
    <p class="lede">Name a target. One Jev request returns its box and whether it is there at all, and the page cuts a square around it, centred and padded: the crop a face or detail pass starts from.</p>
  </header>

  <div class="card">
    <div class="locate-grid">
      <div class="controls">
        <div class="field">
          <span class="field-label" id="samples-label">Image</span>
          <div class="samples" id="samples" role="group" aria-labelledby="samples-label"></div>
          <label class="upload">Upload a PNG or JPEG<input type="file" id="file" accept="image/png,image/jpeg"></label>
        </div>
        <div class="field">
          <label class="field-label" for="target">Find</label>
          <input type="text" id="target" value="${DEFAULT_TARGET}" autocomplete="off">
        </div>
        <div class="field">
          <div class="field-head"><label class="field-label" for="padding">Padding</label><output id="padding-value" for="padding"></output></div>
          <input type="range" id="padding" min="0" max="1.5" step="0.05" value="0.5">
        </div>
        <button class="primary" id="go" disabled>Find and crop</button>
      </div>
      <div class="stage-wrap">
        <div class="stage" id="stage" hidden>
          <img id="photo" alt="">
          <div class="mark" id="crop-mark" hidden></div>
          <div class="mark" id="box-mark" hidden></div>
        </div>
        <p class="stage-empty" id="stage-empty">Pick a sample or upload an image.</p>
      </div>
    </div>
    <div class="legend"><span>Jev's box</span><span class="crop">Square crop</span></div>
  </div>
  <p id="error" role="alert"></p>

  <section id="result-section" aria-live="polite">
    <h2 class="section-title">Crop</h2>
    <div class="card result" id="result">
      <div class="crop-frame"><img id="crop" alt="The square crop around the target"><p id="crop-size"></p></div>
      <div class="readout">
        <div class="scores">
          <div class="score"><div class="label">Box confidence</div><div class="value" id="confidence"></div><p>How sure Jev is of the edges</p></div>
          <div class="score"><div class="label">Target present</div><div class="value" id="presence"></div><p>A yes/no check asked alongside the box</p></div>
        </div>
        <p class="absent-note">Jev thinks the target is probably not in this image, so this box is likely a guess.</p>
        <div class="meta" id="meta"></div>
        <p class="why">A box answer always comes back, even when the target is missing, so the presence check says whether to trust it. Moving the padding re-crops from the same answer, without asking again.</p>
      </div>
    </div>
  </section>

  <footer>${hosted ? "Locating calls the Jev decision API live with the image; samples answer from saved results, so trying them costs nothing." : "Runs locally. Locating calls the Jev decision API with the image; cropping happens on this Mac."}</footer>
</div>

<script>
  var $ = function (id) { return document.getElementById(id); };
  var PRESENT_BELOW = 0.5;
  // Jev reads at most 1568px a side anyway, and a hosted function takes at most 4.5 MB a request, so uploads shrink here.
  var UPLOAD_SIDE = 1568, UPLOAD_QUALITY = 0.9, FIRST_SAMPLE = "cyclist.jpg";
  var image = null, busy = false;

  function pct(n) { return (n * 100).toFixed(0) + "%"; }

  // The server answers errors as JSON, but a proxy in front of the hosted site (a 413 or 502) may not, so a status line stands in.
  function json(r) {
    if (r.ok) return r.json();
    return r.json().catch(function () { return {}; }).then(function (b) {
      throw new Error(b.error || (r.statusText || "Request failed") + " (" + r.status + ")");
    });
  }

  function loadSamples() {
    fetch("/api/locate-samples").then(json).then(function (body) {
      body.samples.forEach(function (s, i) {
        var b = document.createElement("button");
        b.className = "sample";
        b.setAttribute("aria-pressed", "false");
        b.setAttribute("aria-label", s.name);
        b.innerHTML = '<img alt="" src="' + s.url + '">';
        b.onclick = function () { choose({ sample: s.name }, s.url, b); };
        $("samples").appendChild(b);
        if (s.name === FIRST_SAMPLE) b.click();
      });
    }).catch(function (e) { $("error").textContent = e.message; });
  }

  function choose(source, src, button) {
    image = source;
    Array.prototype.forEach.call($("samples").children, function (b) { b.setAttribute("aria-pressed", String(b === button)); });
    $("photo").src = src;
    $("stage").hidden = false;
    $("stage-empty").hidden = true;
    $("box-mark").hidden = $("crop-mark").hidden = true;
    $("result-section").style.display = "none";
    $("error").textContent = "";
    $("go").disabled = false;
  }

  function shrink(file) {
    return createImageBitmap(file).then(function (bitmap) {
      var scale = Math.min(1, UPLOAD_SIDE / Math.max(bitmap.width, bitmap.height));
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", UPLOAD_QUALITY);
    });
  }

  $("file").onchange = function () {
    var file = $("file").files[0];
    if (!file) return;
    shrink(file)
      .then(function (url) { choose({ image: url }, url, null); })
      .catch(function () { $("error").textContent = "Couldn't read " + file.name + " as an image."; });
    $("file").value = "";
  };

  function showPadding() { $("padding-value").textContent = Math.round($("padding").value * 100) + "% a side"; }
  showPadding();
  $("padding").oninput = showPadding;
  $("padding").onchange = function () { if ($("result-section").style.display !== "none") run(); };
  $("go").onclick = run;
  $("target").onkeydown = function (e) { if (e.key === "Enter") run(); };

  function run() {
    if (!image || busy) return;
    busy = true;
    $("go").disabled = true;
    $("go").textContent = "Asking Jev...";
    $("error").textContent = "";
    var sent = image, firstAnswer = $("result-section").style.display === "none";
    var body = Object.assign({ target: $("target").value, padding: Number($("padding").value) }, sent);
    // Choosing another image meanwhile makes this answer about a picture no longer on screen.
    fetch("/api/locate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(json)
      .then(function (r) {
        if (image !== sent) return;
        show(r);
        if (firstAnswer) $("result-section").scrollIntoView({ behavior: "smooth", block: "start" });
      })
      .catch(function (e) { if (image === sent) $("error").textContent = e.message; })
      .then(function () { busy = false; $("go").disabled = false; $("go").textContent = "Find and crop"; });
  }

  function place(mark, left, top, width, height) {
    mark.hidden = false;
    mark.style.left = left * 100 + "%";
    mark.style.top = top * 100 + "%";
    mark.style.width = width * 100 + "%";
    mark.style.height = height * 100 + "%";
  }

  function show(r) {
    var b = r.box, c = r.crop, s = r.size, absent = r.presence < PRESENT_BELOW;
    $("result").classList.toggle("absent", absent);
    if (absent) {
      $("box-mark").hidden = $("crop-mark").hidden = true;
    } else {
      place($("box-mark"), b.left, b.top, b.right - b.left, b.bottom - b.top);
      place($("crop-mark"), c.left / s.width, c.top / s.height, c.size / s.width, c.size / s.height);
    }
    $("crop").src = r.cropUrl;
    $("crop-size").textContent = c.size + " px square from " + s.width + " x " + s.height;
    $("confidence").textContent = pct(r.confidence);
    $("presence").textContent = pct(r.presence);
    var px = function (f, side) { return Math.round(f * side); };
    $("meta").innerHTML =
      "<span>Box <strong>" + px(b.left, s.width) + "-" + px(b.right, s.width) + " x " + px(b.top, s.height) + "-" + px(b.bottom, s.height) + " px</strong></span>" +
      "<span>" + (r.cached ? "<strong>Cached</strong>, no API call" : "<strong>" + (r.latencyMs / 1000).toFixed(1) + " s</strong>") + "</span>" +
      "<span><strong>" + r.inputTokens.toLocaleString() + "</strong> input tokens</span>" +
      "<span><strong>$" + r.costUsd.toFixed(5) + "</strong></span>" +
      "<span>" + r.model + "</span>";
    $("result-section").style.display = "block";
  }

  loadSamples();
</script>
</body>
</html>
`;
