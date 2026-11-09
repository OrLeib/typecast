// What every demo page shares: colour tokens for light and dark, type, buttons, cards, and the top bar that links the pages.
import { logoMark } from "../shared/brand.ts";

/** Where each page lives, the same run locally and hosted. */
export const PAGE_PATHS = { home: "/", route: "/demo", locate: "/locate", results: "/results" };

/**
 * Every movement lives in a block with this query, so a page is static unless the visitor is fine with motion and nothing
 * can leak past a forgotten override. Fades and colour changes aren't movement, so they stay outside it. CSS owns all of
 * it: the browser follows a changed setting by itself, which script-driven animation wouldn't.
 */
export const WITH_MOTION = "@media screen and (prefers-reduced-motion: no-preference)";

/** The three decisions home walks through, in its order. */
const LABELS = { route: "Which model", results: "Which image", locate: "Where in the frame" };

/** The brand, which links home, and the links between pages, with the current one marked for screen readers too. */
export const pageNav = (current?: keyof typeof LABELS) => {
  const links = (Object.keys(LABELS) as (keyof typeof LABELS)[])
    .map((page) => `<a href="${PAGE_PATHS[page]}"${page === current ? ' aria-current="page"' : ""}>${LABELS[page]}</a>`)
    .join("");
  return `<nav class="topbar" aria-label="Pages"><a class="brand" href="${PAGE_PATHS.home}" aria-label="Typecast home">${logoMark(22)}Typecast</a><div class="pages">${links}</div></nav>`;
};

export const BASE_STYLE = `
  :root {
    color-scheme: light;
    --bg: #f4f4f1; --surface: #fcfcfb; --surface-2: #f0efec; --line: #e2e1dc;
    --text: #0b0b0b; --text-2: #52514e; --muted: #6b6a65;
    --accent: #2a78d6; --accent-2: #7aaae8; --accent-soft: #cde2fb; --accent-text: #1b5cb0; --track: #ebeae6; --bar-rest: #c9c8c2;
    --good: #0ca30c; --good-text: #006300; --good-bg: #e3f4e3;
    --warn-text: #7a4f00; --warn-bg: #fdf1d6;
    --danger: #d03b3b;
    --shadow: 0 1px 2px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.04);
    --ease: cubic-bezier(.2, .8, .2, 1);
    /* A damped spring, sampled: CSS has no spring() yet. */
    --spring: linear(0, .151, .45, .738, .944, 1.056, 1.094, 1.086, 1.06, 1.031, 1.009, .997, .992, .991, .994, .996, 1);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      color-scheme: dark;
      --bg: #121211; --surface: #1a1a19; --surface-2: #232321; --line: #2f2f2c;
      --text: #f0efec; --text-2: #c3c2b7; --muted: #8e8d86;
      --accent: #3987e5; --accent-2: #3a6eac; --accent-soft: #1c3557; --accent-text: #a9cdf7; --track: #2a2a27; --bar-rest: #4a4a45;
      --good-text: #5fd35f; --good-bg: #16301a; --warn-text: #fbc756; --warn-bg: #3a2e12;
      --shadow: none;
    }
  }
  @keyframes fade { from { opacity: 0; } }
  ${WITH_MOTION} {
    @view-transition { navigation: auto; }
    html { scroll-behavior: smooth; }
    .topbar { view-transition-name: topbar; }
    /* Pages share only the top bar. Crossfading the rest overlays two unrelated layouts through snapshots that aren't opaque, which flashes. */
    ::view-transition-old(root) { display: none; }
    ::view-transition-new(root) { animation: none; }
  }
  * { box-sizing: border-box; }
  html { background: var(--bg); }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }
  header.top { padding: 40px 0 28px; }
  .topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .brand { display: flex; align-items: center; gap: 8px; font-weight: 650; font-size: 17px; letter-spacing: -0.01em; color: inherit; text-decoration: none; border-radius: 6px; }
  .brand:hover { opacity: .72; }
  .brand:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
  .pages { display: inline-flex; padding: 3px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; gap: 2px; }
  .pages a { padding: 5px 12px; font-size: 13px; font-weight: 500; color: var(--text-2); text-decoration: none; border-radius: 7px; }
  .pages a:hover { color: var(--text); }
  .pages a[aria-current="page"] { background: var(--surface); color: var(--text); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
  .pages a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  h1 { margin: 20px 0 8px; font-size: 34px; line-height: 1.15; letter-spacing: -0.025em; font-weight: 650; max-width: 22ch; text-wrap: balance; }
  .lede { margin: 0; color: var(--text-2); font-size: 16px; max-width: 62ch; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow); }
  .hint { color: var(--muted); font-size: 13px; }
  kbd { font: 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; padding: 2px 5px; border: 1px solid var(--line); border-radius: 4px; background: var(--surface-2); }
  button { font: inherit; font-weight: 550; border-radius: 9px; padding: 9px 16px; cursor: pointer; border: 1px solid var(--line); background: var(--surface); color: var(--text); transition: background .12s, border-color .12s, opacity .12s; }
  button:hover:not(:disabled) { border-color: var(--muted); }
  button:focus-visible, textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  button:disabled { opacity: .45; cursor: default; }
  button.primary { background: var(--text); color: var(--bg); border-color: var(--text); }
  button.primary:hover:not(:disabled) { opacity: .88; border-color: var(--text); }
  section { margin-top: 28px; }
  .section-title { font-size: 12px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin: 0 0 12px; }
  footer { color: var(--muted); font-size: 13px; padding: 40px 0 48px; }
  @media (max-width: 760px) {
    .wrap { padding: 0 16px; }
    .pages { display: flex; width: 100%; }
    /* Each link takes a share of the bar, so the labels sit evenly and the longest still fits at 375px. */
    .pages a { flex: 1 1 auto; display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 5px 8px; white-space: nowrap; }
    header.top { padding: 28px 0 20px; }
    h1 { font-size: 27px; }
  }
`;
