// HTTP client for the SystemOne (Jev) API. Raw fetch on purpose: keep the wire format visible.
import { parseDecisionResponse, type DecisionResponse, type ImageAsset, type Question } from "./parse.ts";

export type DecisionResult = DecisionResponse & { latencyMs: number };

/** Anything that answers SystemOne decision questions: hosted Jev, a local Jev-compatible model, or a test fake. */
export interface DecisionClient {
  /** `assets` are images referenced from the state or instructions by their keys. */
  decide(state: string | object, questions: Record<string, Question>, assets?: Record<string, ImageAsset>): Promise<DecisionResult>;
}

/** A non-2xx answer from the API, keeping the status so callers can tell a retryable outage from a bad request. */
export class JevHttpError extends Error {
  readonly status: number;
  constructor(status: number, body: unknown) {
    super(`Jev ${status}: ${JSON.stringify(body)}`);
    this.status = status;
  }
}

/** Images are opt-in per request: the API rejects an image, or a box question, unless this header is set. */
const IMAGES_HEADER = "TypeSafe-Danger-Zone-Images";

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
    async decide(state, questions, assets) {
      const withImages = assets !== undefined && Object.keys(assets).length > 0;
      const started = now();
      const res = await fetchFn(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          ...(withImages ? { [IMAGES_HEADER]: "true" } : {}),
        },
        body: JSON.stringify({ model: config.model, state, questions, ...(withImages ? { assets } : {}) }),
      }).catch((e: unknown) => {
        throw new Error(`Could not reach Jev at ${endpoint}: ${networkCause(e)}`, { cause: e });
      });
      const raw: unknown = await res.json().catch(() => undefined);
      // Stop after the body: fetch resolves on headers, and the caller waits for the whole answer.
      const latencyMs = now() - started;
      config.onRawResponse?.(raw);
      if (!res.ok) throw new JevHttpError(res.status, raw);
      return { ...parseDecisionResponse(raw), latencyMs };
    },
  };
}

/** Node's fetch rejects with a bare "fetch failed"; the reason (reset, DNS, TLS, timeout) is only in its cause. */
function networkCause(e: unknown): string {
  const cause = e instanceof Error && e.cause instanceof Error ? e.cause : e;
  return cause instanceof Error ? cause.message : String(cause);
}
