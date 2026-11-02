// A static contact sheet of a shootout: every brief's images side by side, with the judge's pick and probabilities,
// so a person can check the picks by eye. Written next to the images, which it links by their relative paths.
import type { ShootoutManifest } from "../generation/manifest.ts";
import type { ShootoutItem } from "../generation/shootout.ts";
import type { Shot } from "../generation/runner.ts";
import { escapeHtml, percent } from "../shared/format.ts";
import type { PickRecord } from "./picks.ts";

export const PICK_SHEET_FILE = "picks.html";

const STYLE = `
  :root {
    --bg: #f4f4f2; --surface: #ffffff; --text: #1c1c1a; --muted: #6b6b66; --line: #dcdcd7; --frame: #e8e8e4;
    --accent: #2a62c4; --bar: #c9c9c3;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #161615; --surface: #1f1f1d; --text: #ededea; --muted: #9a9a94; --line: #34342f; --frame: #262624; --accent: #6ea0ff; --bar: #4a4a45; }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--text); }
  body { font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
  header { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; padding: 16px 24px; border-bottom: 1px solid var(--line); }
  header h1 { margin: 0; font-size: 13px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
  header p { margin: 0; font-size: 13px; color: var(--muted); }
  main { display: flex; flex-direction: column; gap: 40px; padding: 24px; max-width: 1440px; margin: 0 auto; }
  section { display: flex; flex-direction: column; gap: 12px; }
  h2 { margin: 0; font-size: 18px; line-height: 1.4; font-weight: 500; max-width: 80ch; text-wrap: pretty; }
  .meta { margin: 0; font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
  /* One row per brief, so the images compare side by side; two columns on a phone. */
  .shots { display: grid; grid-template-columns: repeat(var(--shots), minmax(0, 1fr)); gap: 12px; }
  @media (max-width: 720px) { .shots { grid-template-columns: repeat(2, minmax(0, 1fr)); } main { padding: 16px; } header { padding: 16px; } }
  figure { margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .frame { aspect-ratio: 1; background: var(--frame); border-radius: 8px; overflow: hidden; outline: 3px solid transparent; outline-offset: 2px; }
  .best .frame { outline-color: var(--accent); }
  .frame img { width: 100%; height: 100%; object-fit: contain; display: block; }
  figcaption { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
  .model { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row { display: flex; align-items: center; gap: 8px; }
  .pct { min-width: 4ch; text-align: right; font-variant-numeric: tabular-nums; }
  .bar { flex: 1; height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--bar); }
  .best .bar span { background: var(--accent); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; min-height: 20px; }
  .tag { font-size: 11px; line-height: 18px; padding: 0 6px; border: 1px solid var(--line); border-radius: 4px; color: var(--muted); }
  .tag.pick { border-color: var(--accent); color: var(--accent); }
`;

export function renderPickSheet(manifest: ShootoutManifest, picks: Map<string, PickRecord>, judge: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shootout Picks</title>
<style>${STYLE}</style>
</head>
<body>
<header><h1>Shootout picks</h1><p>judge ${escapeHtml(judge)} · ${escapeHtml(manifest.meta.data)} · seed ${manifest.meta.seed}</p></header>
<main>
${manifest.items.map((item) => renderItem(item, manifest, picks.get(item.id))).join("\n")}
</main>
</body>
</html>
`;
}

function renderItem(item: ShootoutItem, { meta }: ShootoutManifest, pick: PickRecord | undefined): string {
  const verdict = pick ? `agreement across orders ${percent(pick.agreement, 0)}` : "not picked yet";
  const tagsFor = (shot: Shot) => {
    const routed = shot.generator === meta.lineup[item.route.choice];
    const isDefault = shot.generator === meta.defaultGenerator;
    return [
      ...(shot.generator === pick?.best ? ["pick"] : []),
      ...(routed && isDefault ? ["routed = default"] : routed ? ["routed"] : isDefault ? ["default"] : []),
      ...(shot.generator === meta.lineup[item.expected] ? ["expected"] : []),
    ];
  };
  return `<section>
  <h2>${escapeHtml(item.brief)}</h2>
  <p class="meta">${escapeHtml(item.id)} · expected ${escapeHtml(item.expected)} · routed ${escapeHtml(item.route.choice)} (${item.route.confidence.toFixed(2)}) · ${verdict}</p>
  <div class="shots" style="--shots:${item.shots.length}">${item.shots.map((shot) => renderShot(shot, pick?.probabilities[shot.generator], tagsFor(shot))).join("")}</div>
</section>`;
}

function renderShot(shot: Shot, probability: number | undefined, tags: string[]): string {
  const width = probability === undefined ? 0 : probability * 100;
  return `
    <figure class="${tags.includes("pick") ? "best" : ""}">
      <div class="frame"><img src="${escapeHtml(shot.image)}" alt="${escapeHtml(shot.generator)}" loading="lazy"></div>
      <figcaption>
        <div class="model" title="${escapeHtml(shot.generator)}">${escapeHtml(shot.generator)}</div>
        <div class="row"><div class="bar"><span style="width:${width.toFixed(1)}%"></span></div><span class="pct">${probability === undefined ? "" : percent(probability, 0)}</span></div>
        <div class="tags">${tags.map((t) => `<span class="tag${t === "pick" ? " pick" : ""}">${t}</span>`).join("")}</div>
      </figcaption>
    </figure>`;
}
