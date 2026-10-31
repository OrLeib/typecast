// Minimal client for the SystemOne (Jev) API. Raw fetch on purpose: keep the wire format visible.

export type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};

export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

export type Usage = { input_tokens: number; output_tokens: number };

/** Response envelope, verified against jev-1.14.0. */
export type DecisionResponse = {
  model: string;
  answers: Record<string, ChoiceAnswer>;
  usage: Usage;
};

export type DecisionResult = DecisionResponse & { latencyMs: number };

const baseUrl = () => (process.env.TYPESAFE_BASE_URL ?? "https://api.typesafe.ai").replace(/\/$/, "");

export async function decide(
  state: string | object,
  questions: Record<string, ChoiceQuestion>,
): Promise<DecisionResult> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error("TYPESAFE_API_KEY is not set (see .env.example)");

  const started = performance.now();
  const res = await fetch(`${baseUrl()}/v1/systemone`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.JEV_MODEL ?? "jev-latest", state, questions }),
  });
  const latencyMs = performance.now() - started;

  const raw: unknown = await res.json().catch(() => undefined);
  if (process.env.DEBUG_JEV) console.error(JSON.stringify(raw, null, 2));
  if (!res.ok) throw new Error(`Jev ${res.status}: ${JSON.stringify(raw)}`);

  return { ...parseDecisionResponse(raw), latencyMs };
}

/** Validates the raw response body and throws with the offending path on any mismatch. */
export function parseDecisionResponse(raw: unknown): DecisionResponse {
  const body = record(raw, "response");
  const usage = record(body.usage, "usage");
  const answers = record(body.answers, "answers");
  return {
    model: string(body.model, "model"),
    usage: {
      input_tokens: number(usage.input_tokens, "usage.input_tokens"),
      output_tokens: number(usage.output_tokens, "usage.output_tokens"),
    },
    answers: Object.fromEntries(
      Object.entries(answers).map(([id, a]) => [id, parseChoiceAnswer(a, `answers.${id}`)]),
    ),
  };
}

function parseChoiceAnswer(raw: unknown, path: string): ChoiceAnswer {
  const a = record(raw, path);
  if (a.type !== "choice") throw new Error(`Jev response: ${path}.type must be "choice", got ${JSON.stringify(a.type)}`);
  const probabilities = record(a.probabilities, `${path}.probabilities`);
  const choice = string(a.choice, `${path}.choice`);
  if (!(choice in probabilities)) throw new Error(`Jev response: ${path}.choice "${choice}" is not in probabilities`);
  return {
    type: "choice",
    choice,
    confidence: number(a.confidence, `${path}.confidence`),
    probabilities: Object.fromEntries(
      Object.entries(probabilities).map(([k, p]) => [k, number(p, `${path}.probabilities.${k}`)]),
    ),
  };
}

function record(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error(`Jev response: ${path} must be an object`);
  return v as Record<string, unknown>;
}

function string(v: unknown, path: string): string {
  if (typeof v !== "string") throw new Error(`Jev response: ${path} must be a string`);
  return v;
}

function number(v: unknown, path: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`Jev response: ${path} must be a number`);
  return v;
}
