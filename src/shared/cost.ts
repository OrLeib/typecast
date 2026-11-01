/** USD for `inputTokens` at a list price quoted, as decision-model prices are, per million input tokens. */
export const inputCostUsd = (inputTokens: number, pricePerMillion: number) => (inputTokens * pricePerMillion) / 1e6;
