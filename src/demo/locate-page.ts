// The "Find and crop" demo page: pick several images, name a target, and Jev boxes it in every image at once;
// the page shows each box and a padded square crop around it.
// Page script avoids template literals so this file can stay one template string.
import { MAX_IMAGES } from "../locating/locator.ts";
import { DEFAULT_TARGET } from "./locate-api.ts";
import { BASE_STYLE, pageNav, type SitePaths } from "./page-style.ts";

export const locatePage = ({ paths, hosted }: { paths: SitePaths; hosted: boolean }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Typecast: find and crop</title>
<style>
${BASE_STYLE}
  .locate-grid { display: grid; grid-template-columns: 280px minmax(0, 1fr); }
  .controls { padding: 20px; border-right: 1px solid var(--line); display: flex; flex-direction: column; gap: 16px; }
  .field-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 6px; }
  .field-label { display: block; font-size: 13px; font-weight: 550; color: var(--text-2); }
  .field-head .field-label { margin: 0; }
  .field-note { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .link { padding: 0; border: 0; background: none; font-size: 12px; font-weight: 500; color: var(--accent-text); }
  .link:hover:not(:disabled) { text-decoration: underline; }
  .samples { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .sample { position: relative; padding: 0; border-radius: 9px; overflow: hidden; aspect-ratio: 1; border: 2px solid transparent; background: var(--surface-2); }
  .sample img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: .55; transition: opacity .12s; }
  .sample[aria-pressed="true"] { border-color: var(--accent); }
  .sample[aria-pressed="true"] img { opacity: 1; }
  .sample .tick { position: absolute; top: 4px; right: 4px; width: 18px; height: 18px; border-radius: 50%; display: none; place-items: center; background: var(--accent); color: #fff; }
  .sample .tick svg { width: 11px; height: 11px; }
  .sample[aria-pressed="true"] .tick { display: grid; }
  .upload { display: block; margin-top: 8px; padding: 9px 12px; border: 1px dashed var(--line); border-radius: 9px; text-align: center; font-size: 13px; color: var(--text-2); cursor: pointer; }
  .upload:hover { border-color: var(--muted); }
  .upload:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
  .upload input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  input[type=text] { width: 100%; padding: 9px 11px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface); color: var(--text); font: inherit; }
  input[type=text]:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .padding-head output { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
  input[type=range] { width: 100%; accent-color: var(--accent); margin: 0; }
  .stage-wrap { padding: 20px; min-height: 420px; background: var(--surface-2); border-radius: 0 14px 0 0; display: grid; align-content: center; }
  .stage { display: grid; gap: 14px; grid-template-columns: repeat(var(--cols, 1), minmax(0, 1fr)); align-items: center; justify-items: center; }
  .shot { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; max-width: 100%; }
  /* Clips the crop mark's dimming shadow to the photo. */
  .photo { position: relative; line-height: 0; max-width: 100%; overflow: hidden; border-radius: 8px; }
  .photo img { max-width: 100%; max-height: var(--photo-h, 62vh); display: block; }
  .shot-name { font-size: 12px; color: var(--muted); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mark { position: absolute; pointer-events: none; border-radius: 3px; }
  .mark.box { border: 2px solid var(--accent); box-shadow: 0 0 0 1px rgba(0,0,0,.35); }
  .mark.crop { border: 2px dashed #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.45), 0 0 0 9999px rgba(0,0,0,.28); }
  .shot.absent .mark { display: none; }
  .stage-empty { color: var(--muted); font-size: 14px; text-align: center; }
  .legend { display: flex; gap: 18px; padding: 12px 20px; border-top: 1px solid var(--line); font-size: 13px; color: var(--text-2); }
  .legend span::before { content: ""; display: inline-block; width: 16px; height: 0; margin-right: 7px; vertical-align: middle; border-top: 2px solid var(--accent); }
  .legend span.crop::before { border-top: 2px dashed var(--text-2); }
  #results-section { display: none; }
  .results-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px 16px; flex-wrap: wrap; margin-bottom: 12px; }
  .results-head .section-title { margin: 0; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 16px; color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
  .meta strong { color: var(--text-2); font-weight: 550; }
  .modes { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; padding: 3px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; }
  .modes button { border: 0; background: transparent; padding: 6px 8px; font-size: 13px; font-weight: 500; color: var(--text-2); border-radius: 7px; }
  .modes button[aria-pressed="true"] { background: var(--surface); color: var(--text); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
  .crops { display: grid; gap: 12px; grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)); }
  .crop-card { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .crop-info { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .crops.single .crop-card { flex-direction: row; align-items: flex-start; gap: 24px; padding: 20px; }
  .crops.single .crop-card img { width: 260px; flex: none; }
  .crops.single .crop-info { flex: 1; gap: 14px; }
  .crops.single .crop-name { font-size: 15px; }
  .crops.single .crop-scores { gap: 12px; max-width: 420px; }
  .crops.single .crop-scores div { padding: 14px 16px; border-radius: 12px; background: var(--surface-2); font-size: 13px; }
  .crops.single .crop-scores b { font-size: 30px; }
  .crop-card img { width: 100%; aspect-ratio: 1; border-radius: 9px; display: block; background: var(--surface-2); }
  .crop-card.absent img { opacity: .35; filter: grayscale(1); }
  .crop-name { font-size: 13px; font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .crop-scores { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .crop-scores div { font-size: 12px; color: var(--muted); }
  .crop-scores b { display: block; font-size: 20px; font-weight: 650; letter-spacing: -0.01em; color: var(--text); font-variant-numeric: tabular-nums; }
  .absent-note { font-size: 12px; font-weight: 550; padding: 4px 8px; border-radius: 7px; color: var(--warn-text); background: var(--warn-bg); align-self: flex-start; }
  .why { margin: 14px 0 0; font-size: 14px; color: var(--text-2); max-width: 70ch; }
  #error { color: var(--danger); font-size: 14px; margin: 12px 0 0; }
  @media (max-width: 760px) {
    .locate-grid { grid-template-columns: 1fr; }
    .controls { border-right: 0; border-bottom: 1px solid var(--line); }
    .stage-wrap { border-radius: 0; min-height: 260px; }
    .stage { --cols: 2 !important; }
    .crops:not(.single) { --cols: 2 !important; }
    .crops.single .crop-card { flex-direction: column; }
    .crops.single .crop-card img { width: 100%; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    ${pageNav("locate", paths)}
    <h1 id="headline">Where is it in every image?</h1>
    <p class="lede">Pick one image or many, and name a target. <span>Jev</span> looks at every image at once, one request each, and returns its box and whether the target is there at all; the page cuts a padded square around each, the crop a face or detail pass starts from.</p>
  </header>

  <div class="card">
    <div class="locate-grid">
      <div class="controls">
        <div class="modes" role="group" aria-label="How many images">
          <button id="mode-one" aria-pressed="false">One image</button><button id="mode-many" aria-pressed="true">Many images</button>
        </div>
        <div>
          <div class="field-head"><span class="field-label" id="samples-label">Images</span><button class="link" id="toggle-all"></button></div>
          <div class="samples" id="samples" role="group" aria-labelledby="samples-label"></div>
          <label class="upload">Add PNG or JPEG images<input type="file" id="file" accept="image/png,image/jpeg" multiple></label>
          <div class="field-note" id="count" style="margin-top: 8px"></div>
        </div>
        <div>
          <label class="field-label" for="target" style="margin-bottom: 6px">Find</label>
          <input type="text" id="target" value="${DEFAULT_TARGET}" autocomplete="off">
        </div>
        <div>
          <div class="field-head padding-head"><label class="field-label" for="padding">Padding</label><output id="padding-value" for="padding"></output></div>
          <input type="range" id="padding" min="0" max="1.5" step="0.05" value="0.5">
        </div>
        <button class="primary" id="go" disabled>Find</button>
      </div>
      <div class="stage-wrap">
        <div class="stage" id="stage"></div>
        <p class="stage-empty" id="stage-empty">Pick one or more images.</p>
      </div>
    </div>
    <div class="legend"><span>Jev's box</span><span class="crop">Square crop</span></div>
  </div>
  <p id="error" role="alert"></p>

  <section id="results-section" aria-live="polite">
    <div class="results-head"><h2 class="section-title" id="results-title">Crops</h2><div class="meta" id="meta"></div></div>
    <div class="crops" id="crops"></div>
    <p class="why">A box answer always comes back, even when the target is missing, so each image also gets a yes/no presence check; below 50%, its crop is greyed out and its box hidden. Moving the padding re-crops from the same answers, without asking again.</p>
  </section>

  <footer>${hosted ? "Locating calls the Jev decision API live with the images; samples answer from saved results, so trying them costs nothing." : "Runs locally. Locating calls the Jev decision API with the images; cropping happens on this Mac."}</footer>
</div>

<script>
  var $ = function (id) { return document.getElementById(id); };
  var MAX_IMAGES = ${MAX_IMAGES}, PRESENT_BELOW = 0.5;
  var TICK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>';
  // Every image the page offers: samples by name, uploads by data URL. Order is the order sent and answered.
  var images = [], busy = false, uploads = 0, single = false;

  function pct(n) { return (n * 100).toFixed(0) + "%"; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function selected() { return images.filter(function (im) { return im.on; }); }

  function addImage(image) {
    var b = document.createElement("button");
    b.className = "sample";
    b.setAttribute("aria-label", image.name);
    b.innerHTML = '<img alt="" src="' + image.src + '"><span class="tick">' + TICK + "</span>";
    b.onclick = function () {
      if (single) {
        images.forEach(function (im) { im.on = im === image; });
      } else {
        if (!image.on && selected().length >= MAX_IMAGES) return;
        image.on = !image.on;
      }
      changed();
    };
    image.button = b;
    images.push(image);
    $("samples").appendChild(b);
  }

  function loadSamples() {
    fetch("/api/locate-samples").then(function (r) { return r.json(); }).then(function (body) {
      body.samples.forEach(function (s, i) { addImage({ name: s.name, src: s.url, sample: s.name, on: i < MAX_IMAGES }); });
      changed();
    });
  }

  // Jev reads at most 1568px a side anyway, and a hosted function takes at most 4.5 MB a request, so uploads shrink here.
  var UPLOAD_SIDE = 1568, UPLOAD_QUALITY = 0.9;

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
    Array.prototype.forEach.call($("file").files, function (file) {
      shrink(file).then(function (url) {
        uploads += 1;
        if (single) images.forEach(function (im) { im.on = false; });
        addImage({ name: file.name || "upload " + uploads, src: url, upload: url, on: single || selected().length < MAX_IMAGES });
        changed();
      }).catch(function () { $("error").textContent = "Couldn't read " + file.name + " as an image."; });
    });
    $("file").value = "";
  };

  // One image keeps the first picked; many picks every image, up to the cap.
  function setMode(one) {
    single = one;
    var first = selected()[0] || images[0];
    images.forEach(function (im, i) { im.on = one ? im === first : i < MAX_IMAGES; });
    $("mode-one").setAttribute("aria-pressed", String(one));
    $("mode-many").setAttribute("aria-pressed", String(!one));
    $("file").multiple = !one;
    $("headline").textContent = one ? "Where is it in the image?" : "Where is it in every image?";
    $("results-title").textContent = one ? "Crop" : "Crops";
    changed();
  }
  $("mode-one").onclick = function () { setMode(true); };
  $("mode-many").onclick = function () { setMode(false); };

  $("toggle-all").onclick = function () {
    var turnOn = selected().length === 0;
    images.forEach(function (im, i) { im.on = turnOn && i < MAX_IMAGES; });
    changed();
  };

  // The request sends samples first, then uploads; the answers come back in that order.
  function requestOrder() {
    var on = selected();
    return on.filter(function (im) { return im.sample; }).concat(on.filter(function (im) { return im.upload; }));
  }

  function changed() {
    var on = selected();
    images.forEach(function (im) { im.button.setAttribute("aria-pressed", String(!!im.on)); });
    $("toggle-all").textContent = on.length ? "Clear" : "Select all";
    $("toggle-all").hidden = single;
    $("count").textContent = single ? "" : on.length + " selected" + (images.length > MAX_IMAGES ? ", up to " + MAX_IMAGES : "");
    $("go").disabled = busy || on.length === 0;
    $("go").textContent = on.length > 1 ? "Find in " + on.length + " images" : "Find";
    $("results-section").style.display = "none";
    $("error").textContent = "";
    drawStage(requestOrder());
  }

  // Rows stay full for the common counts: 2 x 2 up to four images, 3 x 3 up to nine.
  function columnsFor(n) { return n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4; }

  function drawStage(order) {
    var cols = columnsFor(order.length);
    $("stage").style.setProperty("--cols", cols);
    $("stage").style.setProperty("--photo-h", order.length <= 1 ? "62vh" : cols <= 2 ? "30vh" : "22vh");
    $("stage").innerHTML = order.map(function (im, i) {
      return '<div class="shot" id="shot-' + i + '"><div class="photo"><img alt="" src="' + im.src + '"><div class="mark crop" hidden></div><div class="mark box" hidden></div></div><span class="shot-name">' + esc(im.name) + "</span></div>";
    }).join("");
    $("stage-empty").hidden = order.length > 0;
  }

  function showPadding() { $("padding-value").textContent = Math.round($("padding").value * 100) + "% a side"; }
  showPadding();
  $("padding").oninput = showPadding;
  $("padding").onchange = function () { if ($("results-section").style.display !== "none") run(); };
  $("go").onclick = run;
  $("target").onkeydown = function (e) { if (e.key === "Enter") run(); };

  function run() {
    var order = requestOrder();
    if (!order.length || busy) return;
    busy = true;
    $("go").disabled = true;
    $("go").textContent = "Asking Jev...";
    $("error").textContent = "";
    var body = {
      samples: order.filter(function (im) { return im.sample; }).map(function (im) { return im.sample; }),
      images: order.filter(function (im) { return im.upload; }).map(function (im) { return im.upload; }),
      target: $("target").value,
      padding: Number($("padding").value)
    };
    fetch("/api/locate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (b) { if (!r.ok) throw new Error(b.error); return b; }); })
      .then(function (r) { show(r, order); })
      .catch(function (e) { $("error").textContent = e.message; })
      .then(function () { busy = false; changedButtonOnly(); });
  }

  function changedButtonOnly() {
    var on = selected();
    $("go").disabled = on.length === 0;
    $("go").textContent = on.length > 1 ? "Find in " + on.length + " images" : "Find";
  }

  function place(mark, left, top, width, height) {
    mark.hidden = false;
    mark.style.left = left * 100 + "%";
    mark.style.top = top * 100 + "%";
    mark.style.width = width * 100 + "%";
    mark.style.height = height * 100 + "%";
  }

  function show(r, order) {
    r.images.forEach(function (im, i) {
      var shot = $("shot-" + i);
      if (!shot) return;
      var b = im.box, c = im.crop, s = im.size;
      shot.classList.toggle("absent", im.presence < PRESENT_BELOW);
      place(shot.querySelector(".mark.box"), b.left, b.top, b.right - b.left, b.bottom - b.top);
      place(shot.querySelector(".mark.crop"), c.left / s.width, c.top / s.height, c.size / s.width, c.size / s.height);
    });
    $("crops").innerHTML = r.images.map(function (im, i) {
      var absent = im.presence < PRESENT_BELOW, name = esc(order[i] ? order[i].name : im.name);
      return '<div class="card crop-card' + (absent ? " absent" : "") + '"><img alt="Crop around the target in ' + name + '" src="' + im.cropUrl + '">' +
        '<div class="crop-info"><div class="crop-name" title="' + name + '">' + name + "</div>" +
        '<div class="crop-scores"><div><b>' + pct(im.confidence) + "</b>box confidence</div><div><b>" + pct(im.presence) + "</b>present</div></div>" +
        (absent ? '<span class="absent-note">Probably not in this image</span>' : "") + "</div></div>";
    }).join("");
    var n = r.images.length;
    // One image gets the wide card beside its scores; up to four crops sit in one row of four.
    $("crops").classList.toggle("single", n === 1);
    $("crops").style.setProperty("--cols", n === 1 ? 1 : n <= 4 ? 4 : columnsFor(n));
    $("meta").innerHTML =
      "<span><strong>" + n + " image" + (n === 1 ? "</strong>, one request" : "s</strong>, one request each, in parallel") + "</span>" +
      "<span>" + (r.cached ? "<strong>Cached</strong>, no API call" : "<strong>" + (r.latencyMs / 1000).toFixed(1) + " s</strong>") + "</span>" +
      "<span><strong>" + r.inputTokens.toLocaleString() + "</strong> input tokens</span>" +
      "<span><strong>$" + r.costUsd.toFixed(5) + "</strong></span>" +
      "<span>" + esc(r.model) + "</span>";
    $("results-section").style.display = "block";
  }

  loadSamples();
</script>
</body>
</html>
`;
