// The blind-judging page. Self-contained: no build step, no external assets.
// It never learns which side is routed; the server maps left/right back to routed/default.
import { escapeHtml } from "../shared/format.ts";

/** `dir` is the run being judged, named in the closing hint so the report command can be copied as is. */
export function judgePage(dir: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Typecast Judge</title>
<style>
  :root {
    --bg: #f4f4f2; --surface: #ffffff; --text: #1c1c1a; --muted: #6b6b66; --line: #dcdcd7;
    --accent: #1c1c1a; --accent-text: #ffffff; --frame: #e8e8e4;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #161615; --surface: #1f1f1d; --text: #ededea; --muted: #9a9a94; --line: #34342f; --accent: #ededea; --accent-text: #161615; --frame: #262624; }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--text); }
  body { font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; min-height: 100vh; display: flex; flex-direction: column; }
  header { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 16px 24px; border-bottom: 1px solid var(--line); }
  header h1 { margin: 0; font-size: 13px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
  #progress { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
  main { flex: 1; display: flex; flex-direction: column; gap: 20px; padding: 24px; max-width: 1440px; width: 100%; margin: 0 auto; }
  #brief { margin: 0; font-size: 20px; line-height: 1.4; font-weight: 500; max-width: 70ch; text-wrap: pretty; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  figure { margin: 0; display: flex; flex-direction: column; gap: 12px; }
  .frame { aspect-ratio: 1; background: var(--frame); border-radius: 8px; overflow: hidden; }
  .frame img { width: 100%; height: 100%; object-fit: contain; display: block; }
  figcaption { display: flex; }
  button { font: inherit; font-weight: 500; border-radius: 8px; padding: 10px 16px; cursor: pointer; border: 1px solid var(--line); background: var(--surface); color: var(--text); }
  button:hover { border-color: var(--muted); }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  button:disabled { opacity: 0.5; cursor: default; }
  figcaption button { flex: 1; }
  kbd { font: 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; padding: 2px 6px; margin-left: 8px; border: 1px solid var(--line); border-radius: 4px; color: var(--muted); }
  .actions { display: flex; justify-content: center; gap: 12px; }
  #done { display: none; text-align: center; padding: 64px 16px; }
  #done p { color: var(--muted); }
  #done code { font: 13px ui-monospace, SFMono-Regular, Menlo, monospace; }
  #error { color: #c4372c; min-height: 1.5em; margin: 0; text-align: center; }
  @media (max-width: 720px) {
    header, main { padding-left: 16px; padding-right: 16px; }
    .pair { grid-template-columns: 1fr; }
    #brief { font-size: 17px; }
    kbd { display: none; }
  }
</style>
</head>
<body>
<header><h1>Typecast · blind judging</h1><span id="progress"></span></header>
<main>
  <section id="judging">
    <p id="brief"></p>
  </section>
  <div class="pair" id="pair">
    <figure><div class="frame"><img id="left" alt="Left image"></div><figcaption><button data-pick="left">Left is better<kbd>←</kbd></button></figcaption></figure>
    <figure><div class="frame"><img id="right" alt="Right image"></div><figcaption><button data-pick="right">Right is better<kbd>→</kbd></button></figcaption></figure>
  </div>
  <div class="actions" id="actions">
    <button data-pick="tie">No preference<kbd>↓</kbd></button>
    <button id="undo">Undo<kbd>Z</kbd></button>
  </div>
  <p id="error" role="alert"></p>
  <section id="done"><h2>All pairs judged</h2><p>Run <code>npm run judge-report -- ${escapeHtml(dir)}</code> for the win rate.</p></section>
</main>
<script>
  let current = null;
  let busy = false;
  const $ = (id) => document.getElementById(id);

  function render(state) {
    $("progress").textContent = state.judged + " of " + state.total + " judged";
    current = state.pair;
    const finished = !current;
    for (const id of ["judging", "pair", "actions"]) $(id).style.display = finished ? "none" : "";
    $("done").style.display = finished ? "block" : "none";
    $("undo").disabled = state.judged === 0;
    if (finished) return;
    $("brief").textContent = current.brief;
    $("left").src = current.left;
    $("right").src = current.right;
  }

  async function call(path, body) {
    if (busy) return;
    busy = true;
    $("error").textContent = "";
    try {
      const res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      render(data);
    } catch (e) {
      $("error").textContent = e.message;
    } finally {
      busy = false;
    }
  }

  const pick = (p) => current && call("/api/judge", { id: current.id, pick: p });
  const undo = () => call("/api/undo", {});

  document.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => pick(b.dataset.pick)));
  $("undo").addEventListener("click", undo);
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const keys = { ArrowLeft: () => pick("left"), ArrowRight: () => pick("right"), ArrowDown: () => pick("tie"), z: undo, Z: undo };
    if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
  });
  call("/api/next");
</script>
</body>
</html>
`;
}
