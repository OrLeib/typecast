// Retries a DecisionClient through brief outages. A decorator, so callers that need it opt in and the HTTP client stays plain.
import { JevHttpError, type DecisionClient } from "./client.ts";

export type RetryOptions = { attempts: number; delayMs: number; sleep?: (ms: number) => Promise<void> };

/** 5xx answers and network failures can pass on their own; a 4xx means the request itself is wrong, so it fails at once. */
const isRetryable = (e: unknown) => !(e instanceof JevHttpError) || e.status >= 500;

export function withRetries(client: DecisionClient, { attempts, delayMs, sleep = defaultSleep }: RetryOptions): DecisionClient {
  return {
    async decide(state, questions, assets) {
      for (let attempt = 1; ; attempt++) {
        try {
          return await client.decide(state, questions, assets);
        } catch (e) {
          if (attempt >= attempts || !isRetryable(e)) throw e;
          // Back off linearly: outages seen so far cleared within seconds.
          await sleep(delayMs * attempt);
        }
      }
    },
  };
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
