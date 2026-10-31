# brief-router

## What this is
A model router for AI media generation: given a creative brief, pick which image/video model
should handle it, with a calibrated confidence. Built on decision models (TypeSafe's Jev and
Jev-compatible open models), not chat LLMs.

## Why
AI media tools expose many models. Users don't know which model
fits their brief, and wrong picks waste credits and time. A router answers "which model?" in
~150ms for fractions of a cent, and its confidence tells the UI when to just pick vs. show the
top two side by side.

## Principles
- **Generic core, adapters at the edge.** The router knows nothing about any specific product.
  Model rosters and generators are pluggable, and a product plugs in as an adapter.
  Never name or allude to a specific product anywhere public: code, docs, the site, commits.
- **Measure before believing.** Every claim in the README is backed by numbers from `eval`.
  Calibration (does 0.9 confidence mean 90% right?) matters as much as accuracy.
- **Swap models by base URL.** Jev, Kev, Laya, Clef all speak `POST /v1/systemone`.
  `TYPESAFE_BASE_URL` switches between hosted Jev and a local open model.

## Milestones
1. **Level 1 — routing accuracy (no images).** Labelled briefs → expected model.
   Run router, report accuracy, ECE (Expected Calibration Error), reliability bins,
   latency p50/p95, cost. ← current
2. **Level 2 — confirm with images.** For ~50 briefs, generate with the routed model and 1–2
   alternatives (locally via mflux/Draw Things/ComfyUI on the M5 Mac, or a hosted API), judge
   winners (by hand first, then Clef as auto-judge). Metric: routed-model win rate vs. a
   single default model.
3. **Level 3 — real roster.** Replace the placeholder roster with a real product's model list.

## Stack
- Node 22+, TypeScript, ESM. Run TS directly with `node --experimental-strip-types`.
- Raw `fetch` against the Jev API (keep the wire format visible; no SDK for now).
- Vitest for tests.
- Data as JSON/JSONL under `data/`.

## Jev API (verify against https://docs.typesafe.ai before relying on details)
- `POST {base}/v1/systemone`, `Authorization: Bearer $TYPESAFE_API_KEY`.
- Body: `{ model: "jev-latest", state: string|object, questions: { [id]: { type, instructions, criteria } } }`.
- Types: `choice` (criteria = { optionId: description }, 1–255 options),
  `score` (2–10 ordered levels), `noul` (yes/no).
- Choice answer: `choice`, `probabilities` (per option), `confidence`.
- Response reports the exact model version (e.g. `jev-1.13.0`) and `usage`
  (input tokens billed; output free). Log both with every eval run.
- The exact response envelope was not verified yet — `src/jev.ts` logs the raw response
  with `DEBUG_JEV=1`; tighten the types once confirmed.

## Conventions
- Never commit `.env`. The repo is public.
- Eval runs write timestamped JSON to `runs/` (gitignored) so results are reproducible.
- Keep README numbers in sync with the latest committed eval summary.
