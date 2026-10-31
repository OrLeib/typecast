// Minimal client for the SystemOne (Jev) API. Raw fetch on purpose: keep the wire format visible.

export type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};

export type ChoiceAnswer = {
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

export type DecisionResult = {
  answers: Record<string, ChoiceAnswer>;
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  latencyMs: number;
};

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

  const raw: any = await res.json().catch(() => ({}));
  if (process.env.DEBUG_JEV) console.error(JSON.stringify(raw, null, 2));
  if (!res.ok) throw new Error(`Jev ${res.status}: ${JSON.stringify(raw)}`);

  // Envelope not verified yet: accept answers at top level or under `answers`.
  const answers = raw.answers ?? raw;
  return { answers, model: raw.model, usage: raw.usage, latencyMs };
}
