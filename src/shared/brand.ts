// The Typecast mark: a T whose stem forks into three routes, the chosen one highlighted.
// The same drawing as docs/brand/logo.svg, drawn in currentColor so it follows each page's light and dark text colour.

export const REPO_URL = "https://github.com/OrLeib/typecast";

const ROUTES_GRADIENT_ID = "typecast-route";
// The drawing's bounds plus a little air; docs/brand/logo.svg keeps the full 512 square for padding around it.
const VIEW_BOX = "72 72 368 368";

const MARK = `<defs><linearGradient id="${ROUTES_GRADIENT_ID}" gradientUnits="userSpaceOnUse" x1="256" y1="236" x2="411" y2="390"><stop offset="0" stop-color="#8b2cf5"/><stop offset="1" stop-color="#ff6b5b"/></linearGradient></defs>
<g transform="translate(-12 0)" fill="none" stroke-width="44" stroke-linecap="round" stroke-linejoin="round">
<g stroke="currentColor" opacity="0.3"><path d="M256 230 C256 300 200 350 128 380"/><path d="M256 230 V384"/></g>
<path stroke="url(#${ROUTES_GRADIENT_ID})" d="M256 230 C256 296 300 342 360 368"/>
<path stroke="currentColor" d="M138 128 H374 M256 128 V230"/>
<circle cx="411" cy="390" r="20" fill="#ff6b5b" stroke="none"/>
</g>`;

/** The mark inline in a page, `size` px square. Decorative: the brand name sits next to it as text. */
export const logoMark = (size: number) =>
  `<svg class="logo-mark" viewBox="${VIEW_BOX}" width="${size}" height="${size}" aria-hidden="true" focusable="false">${MARK}</svg>`;

// A favicon has no page around it to inherit a colour from, so it sets its own for each scheme.
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}" style="color:#2f3238"><style>@media (prefers-color-scheme: dark){svg{color:#e8eaed}}</style>${MARK}</svg>`;

/** A `<link rel="icon">` carrying the mark inline, so pages stay self-contained. */
export const FAVICON_LINK = `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}">`;
