// A deliberately naive router: the first keyword rule that matches wins. It needs no model, so it
// serves as a difficulty probe. A brief set it scores well on is too explicit to tell routers apart.
import type { Route, Router } from "./router.ts";

export type KeywordRule = { category: string; pattern: RegExp };

export const KEYWORD_ROUTER_MODEL = "keyword-rules-v1";

/** Written from the labelling rules in CLAUDE.md, in the same priority order. Fixed: don't tune it to a brief set. */
export const KEYWORD_RULES: readonly KeywordRule[] = [
  { category: "video", pattern: /\b(clips?|loops?|looping|animat\w*|gif|cinemagraph|seconds?|secs?|\d+\s?s|video|time-?lapse|slow[- ]?mo\w*|flyover|reel|sequence|footage)\b/ },
  { category: "fast-draft", pattern: /\b(roughs?|quick|quickly|drafts?|throwaway|placeholders?|cheap|fast|low[- ]?res|variations?|variants|ideas|brainstorm\w*|sketchy|thumbnails?|quantity|ideation|test)\b/ },
  { category: "typography", pattern: /'[^']{2,}'|\b(says|saying|reads?|readable|legible|text|title|headline|wordmark|caption|label|sign|lettering|font|typography|words?)\b/ },
  { category: "illustration", pattern: /\b(illustrat\w*|watercolou?r|vector|anime|cartoon|drawing|drawn|sketch|painted|painterly|gouache|pixel art|comic|linocut|line art|isometric|mascot|icons?|character design|storybook|hand-drawn|doodle|clip ?art)\b/ },
  { category: "product", pattern: /\b(packshot|product|white (bg|background)|e-?commerce|studio|backdrop|seamless|listing|catalog\w*|shop\w*|podium|pedestal|bottle|packaging)\b/ },
  { category: "photoreal", pattern: /\b(photo\w*|realistic|candid|natural light|portrait|shot on|\d+mm|drone|aerial|lifestyle)\b/ },
];

export function createKeywordRouter(categories: readonly string[], rules: readonly KeywordRule[] = KEYWORD_RULES, fallback = "photoreal"): Router {
  for (const c of [fallback, ...rules.map((r) => r.category)]) {
    if (!categories.includes(c)) throw new Error(`Keyword rule category "${c}" is not in the roster`);
  }
  return {
    async route(brief): Promise<Route> {
      const text = brief.toLowerCase();
      const choice = rules.find((r) => r.pattern.test(text))?.category ?? fallback;
      const probabilities = Object.fromEntries(categories.map((c) => [c, c === choice ? 1 : 0]));
      return { type: "choice", choice, confidence: 1, probabilities, model: KEYWORD_ROUTER_MODEL, inputTokens: 0, latencyMs: 0 };
    },
  };
}
