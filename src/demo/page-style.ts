// What every demo page shares: colour tokens for light and dark, type, buttons, cards, and the top bar that links the pages.

/** Where each page lives. Run locally, the routing demo is the home page; hosted, the results showcase is. */
export type SitePaths = { results?: string; route: string; locate: string };

export const LOCAL_PATHS: SitePaths = { route: "/", locate: "/locate" };
export const HOSTED_PATHS: SitePaths = { results: "/", route: "/demo", locate: "/locate" };

const LABELS: Record<keyof SitePaths, string> = { results: "Results", route: "Route a brief", locate: "Find and crop" };

/** The links between pages, in order, with the current one marked for screen readers too. */
export const pageLinks = (current: keyof SitePaths | undefined, paths: SitePaths) =>
  (Object.keys(LABELS) as (keyof SitePaths)[])
    .filter((page) => paths[page] !== undefined)
    .map((page) => `<a href="${paths[page]}"${page === current ? ' aria-current="page"' : ""}>${LABELS[page]}</a>`)
    .join("");

/** The brand and the links between pages. */
export const pageNav = (current: keyof SitePaths, paths: SitePaths) =>
  `<nav class="topbar" aria-label="Demo pages"><div class="brand"><span class="brand-mark">T</span>Typecast</div><div class="pages">${pageLinks(current, paths)}</div></nav>`;

export const BASE_STYLE = `
  :root {
    color-scheme: light;
    --bg: #f4f4f1; --surface: #fcfcfb; --surface-2: #f0efec; --line: #e2e1dc;
    --text: #0b0b0b; --text-2: #52514e; --muted: #6b6a65;
    --accent: #2a78d6; --accent-2: #7aaae8; --accent-soft: #cde2fb; --accent-text: #1b5cb0; --track: #ebeae6; --bar-rest: #c9c8c2;
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
      --accent: #3987e5; --accent-2: #3a6eac; --accent-soft: #1c3557; --accent-text: #a9cdf7; --track: #2a2a27; --bar-rest: #4a4a45;
      --good-text: #5fd35f; --good-bg: #16301a; --warn-text: #fbc756; --warn-bg: #3a2e12;
      --shadow: none;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --bg: #121211; --surface: #1a1a19; --surface-2: #232321; --line: #2f2f2c;
    --text: #f0efec; --text-2: #c3c2b7; --muted: #8e8d86;
    --accent: #3987e5; --accent-2: #3a6eac; --accent-soft: #1c3557; --accent-text: #a9cdf7; --track: #2a2a27; --bar-rest: #4a4a45;
    --good-text: #5fd35f; --good-bg: #16301a; --warn-text: #fbc756; --warn-bg: #3a2e12;
    --shadow: none;
  }
  * { box-sizing: border-box; }
  html { background: var(--bg); }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }
  header.top { padding: 40px 0 28px; }
  .topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 650; font-size: 17px; letter-spacing: -0.01em; }
  .brand-mark { width: 22px; height: 22px; border-radius: 6px; background: var(--text); color: var(--bg); display: grid; place-items: center; font-size: 13px; font-weight: 700; }
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
    header.top { padding: 28px 0 20px; }
    h1 { font-size: 27px; }
  }
`;
