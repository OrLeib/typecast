// HTTP client for the SystemOne (Jev) API. Raw fetch on purpose: keep the wire format visible.
import { parseDecisionResponse, type ChoiceQuestion, type DecisionResponse } from "./parse.ts";

export type DecisionResult = DecisionResponse & { latencyMs: number };

/** Anything that answers SystemOne decision questions: hosted Jev, a local Jev-compatible model, or a test fake. */
export interface DecisionClient {
  decide(state: string | object, questions: Record<string, ChoiceQuestion>): Promise<DecisionResult>;
}

export const JEV_DEFAULT_BASE_URL = "https://api.typesafe.ai";
export const JEV_DEFAULT_MODEL = "jev-latest";
/** USD per million input tokens at Jev list price; output tokens are free. */
export const JEV_INPUT_PRICE_PER_MILLION = 0.042;

export type JevConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** Receives every raw response body before parsing. */
  onRawResponse?: (raw: unknown) => void;
};

export type JevClientDeps = { fetch?: typeof fetch; now?: () => number };

export function createJevClient(config: JevConfig, deps: JevClientDeps = {}): DecisionClient {
  const fetchFn = deps.fetch ?? fetch;
  const now = deps.now ?? (() => performance.now());
  const endpoint = `${config.baseUrl.replace(/\/$/, "")}/v1/systemone`;

  return {
    async decide(state, questions) {
      const started = now();
      const res = await fetchFn(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: config.model, state, questions }),
      });
      const latencyMs = now() - started;

      const raw: unknown = await res.json().catch(() => undefined);
      config.onRawResponse?.(raw);
      if (!res.ok) throw new Error(`Jev ${res.status}: ${JSON.stringify(raw)}`);
      return { ...parseDecisionResponse(raw), latencyMs };
    },
  };
}
