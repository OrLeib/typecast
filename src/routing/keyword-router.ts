// A deliberately naive router: the first keyword rule that matches wins. It needs no model, so it
// serves as a difficulty probe. A brief set it scores well on is too explicit to tell routers apart.
import type { Route, Router } from "./router.ts";

export const KEYWORD_ROUTER_MODEL = "keyword-rules-v1";

/**
 * Written from the labelling rules in CLAUDE.md. The order matches them except that illustration is checked before
 * product and photoreal (CLAUDE.md checks it last). Fixed anyway: don't tune it to a brief set, or past runs stop
 * being comparable.
 */
const KEYWORD_RULES: readonly { category: string; pattern: RegExp }[] = [
  { category: "video", pattern: /\b(clips?|loops?|looping|animat\w*|gif|cinemagraph|seconds?|secs?|\d+\s?s|video|time-?lapse|slow[- ]?mo\w*|flyover|reel|sequence|footage)\b/ },
  { category: "fast-draft", pattern: /\b(roughs?|quick|quickly|drafts?|throwaway|placeholders?|cheap|fast|low[- ]?res|variations?|variants|ideas|brainstorm\w*|sketchy|thumbnails?|quantity|ideation|test)\b/ },
  { category: "typography", pattern: /'[^']{2,}'|\b(says|saying|reads?|readable|legible|text|title|headline|wordmark|caption|label|sign|lettering|font|typography|words?)\b/ },
  { category: "illustration", pattern: /\b(illustrat\w*|watercolou?r|vector|anime|cartoon|drawing|drawn|sketch|painted|painterly|gouache|pixel art|comic|linocut|line art|isometric|mascot|icons?|character design|storybook|hand-drawn|doodle|clip ?art)\b/ },
  { category: "product", pattern: /\b(packshot|product|white (bg|background)|e-?commerce|studio|backdrop|seamless|listing|catalog\w*|shop\w*|podium|pedestal|bottle|packaging)\b/ },
  { category: "photoreal", pattern: /\b(photo\w*|realistic|candid|natural light|portrait|shot on|\d+mm|drone|aerial|lifestyle)\b/ },
];

/** Where a brief goes when no rule matches. */
const FALLBACK = "photoreal";

export function createKeywordRouter(categories: readonly string[]): Router {
  for (const c of [FALLBACK, ...KEYWORD_RULES.map((r) => r.category)]) {
    if (!categories.includes(c)) throw new Error(`Keyword rule category "${c}" is not in the roster`);
  }
  return {
    async route(brief): Promise<Route> {
      const text = brief.toLowerCase();
      const choice = KEYWORD_RULES.find((r) => r.pattern.test(text))?.category ?? FALLBACK;
      const probabilities = Object.fromEntries(categories.map((c) => [c, c === choice ? 1 : 0]));
      return { choice, confidence: 1, probabilities, model: KEYWORD_ROUTER_MODEL, inputTokens: 0, latencyMs: 0 };
    },
  };
}
