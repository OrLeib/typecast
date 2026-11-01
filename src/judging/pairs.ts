import { isPair, type GenerationItem, type PairItem } from "../generation/runner.ts";

/** A pair needs judging only when routing picked a different model than the default. */
export const needsJudging = (item: GenerationItem): item is PairItem => isPair(item) && item.routed.generator !== item.default.generator;
