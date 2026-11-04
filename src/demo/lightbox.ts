// The lightbox both image pages share: click an image to enlarge it, then step through its brief's lineup.
import { escapeHtml } from "../shared/format.ts";
import type { ShootoutBrief, ShootoutShot } from "./shootout-evidence.ts";

export const LIGHTBOX_STYLE = `
  .frame { aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: var(--surface-2); outline: 2.5px solid transparent; outline-offset: 3px; }
  .best .frame { outline-color: var(--accent); }
  .frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
  button.frame { display: block; width: 100%; padding: 0; border: 0; font: inherit; color: inherit; cursor: zoom-in; }
  button.frame:focus-visible { outline-color: var(--accent); }
  button.frame img { transition: transform .25s ease; }
  button.frame:hover img { transform: scale(1.03); }
  @media (prefers-reduced-motion: reduce) { button.frame img { transition: none; } }
  #lightbox { padding: 0; border: 0; margin: 0; width: 100vw; height: 100dvh; max-width: none; max-height: none; background: transparent; color: #f0efec; }
  #lightbox::backdrop { background: rgba(10, 10, 9, .96); backdrop-filter: blur(8px); }
  .lb-stage { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 56px 72px 24px; }
  .lb-stage img { max-width: 100%; max-height: calc(100dvh - 170px); aspect-ratio: 1; object-fit: contain; border-radius: 10px; background: #252523; }
  .lb-cap { margin: 0; text-align: center; max-width: 70ch; }
  .lb-cap b { display: block; font-size: 16px; font-weight: 600; }
  .lb-cap span { display: block; font-size: 14px; color: #a8a79f; margin-top: 2px; }
  #lightbox button { position: absolute; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 999px; padding: 0; border: 0; background: rgba(255, 255, 255, .1); color: inherit; font: 26px/1 inherit; cursor: pointer; }
  #lightbox button:hover { background: rgba(255, 255, 255, .2); }
  #lightbox button:focus-visible { outline: 2px solid #6ea0ff; outline-offset: 2px; }
  .lb-close { top: 14px; right: 14px; }
  .lb-prev { left: 16px; top: 50%; transform: translateY(-50%); }
  .lb-next { right: 16px; top: 50%; transform: translateY(-50%); }
  @media (max-width: 760px) {
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

/** The viewer and its script: put once at the end of a page whose briefs are `article`s with a `.lineup` of frames. */
export const LIGHTBOX = `<dialog id="lightbox" aria-label="Image viewer" autofocus>
  <div class="lb-stage"><img alt=""><p class="lb-cap"><b></b><span></span></p></div>
  <button class="lb-prev" type="button" aria-label="Previous image">&#8249;</button>
  <button class="lb-next" type="button" aria-label="Next image">&#8250;</button>
  <button class="lb-close" type="button" aria-label="Close">&times;</button>
</dialog>
<script>${LIGHTBOX_SCRIPT}</script>`;

/** "mflux:z-image-turbo@q8" reads as "z-image-turbo": the runner and quantization are noise to a reader. */
export const modelName = (generator: string) => generator.replace(/^[^:]+:/, "").replace(/@.*$/, "");

/** A clickable image: `index` is its place in the brief's lineup, where the lightbox starts. */
export const frame = (shot: ShootoutShot, index: number, alt: string, caption = "") =>
  `<button class="frame" type="button" data-shot="${index}"${caption && ` data-caption="${escapeHtml(caption)}"`}><img src="${escapeHtml(shot.url)}" alt="${escapeHtml(alt)}" loading="lazy"></button>`;

/** "krea2 · Typecast's pick · judge's pick": what the lightbox says about an image. */
export function shotCaption(brief: ShootoutBrief, shot: ShootoutShot, defaultGenerator: string) {
  const roles = [
    shot.generator === brief.routedGenerator && "Typecast's pick",
    shot.generator === defaultGenerator && "default",
    shot.picked && "judge's pick",
  ].filter(Boolean);
  return [modelName(shot.generator), ...roles].join(" · ");
}
