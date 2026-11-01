# Typecast

## What this is
A model router for AI media generation: given a creative brief, pick which image/video model
should handle it, with a calibrated confidence. Built on decision models (TypeSafe's Jev and
Jev-compatible open models), not chat LLMs.

## Why
AI media tools expose many models. Users don't know which model
fits their brief, and wrong picks waste credits and time. A router answers "which model?" in
~200ms for fractions of a cent, and its confidence tells the UI when to just pick vs. show the
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
   winners (by hand first, then Jev as auto-judge, reading both images). Metric: routed-model win rate vs. a
   single default model.
3. **Level 3 — real roster.** Replace the placeholder roster with a real product's model list.

## Stack
- Node 22+, TypeScript, ESM. Run TS directly with `node --experimental-strip-types`.
- Raw `fetch` against the Jev API (keep the wire format visible; no SDK for now).
- Vitest for tests.
- Data as JSON/JSONL under `data/`.

## Architecture
Dependencies point inward: `cli/` -> `demo/`, `judging/`, `generation/`, `comparison/`, `evaluation/` -> `routing/` -> `jev/`. Nothing below `cli/` reads `process.env`.

| Module | Responsibility |
|---|---|
| `jev/parse.ts` | Wire types and strict response validation |
| `jev/client.ts` | `DecisionClient` interface; HTTP implementation with injected config, `fetch` and clock |
| `routing/` | `Router` interface, the decision-model router, the pick-or-compare recommendation, the keyword difficulty probe, roster and variants |
| `evaluation/` | Briefs, pure metrics, metric registry, runner, summary, report formatting, run store |
| `comparison/` | Paired statistics, run comparison, report formatting |
| `generation/` | `Generator` interface, the mflux adapter, the local lineup, fixed brief sample, pair runner, manifest store |
| `judging/` | Judgments store, blind side and order, win-rate statistics, report formatting, the local judging server and page |
| `demo/` | Local demo server and page: live route, pick-or-compare recommendation, local render, latest eval evidence |
| `cli/` | Composition roots: read env and args, wire implementations, print |

SOLID, and where it lives:
- **S** - one reason to change per module: parsing vs transport (`jev/`), running vs summarising vs formatting vs storing (`evaluation/`), computing vs printing (`comparison/`).
- **O** - extend by adding entries, not editing code: a metric is one entry in `RUN_METRICS` (summary and compare pick it up), a routing change is one entry in `VARIANTS`.
- **L** - any `DecisionClient` can stand in for another. `test/jev/decision-client.contract.ts` is the contract; the HTTP client and the test fake both run it. A new client (e.g. a local model) must pass it too.
- **I** - small interfaces: `Router` has only `route`, `DecisionClient` only `decide`; metrics take the narrowest prediction type they need.
- **D** - high-level code depends on abstractions: `runEval` takes a `Router`, the router takes a `DecisionClient`, the client takes config and `fetch`. Only `cli/` picks implementations.

Clean Code conventions: intention-revealing names, small single-purpose functions, named constants instead of magic numbers, errors that name the offending field, and comments only for the "why".

## Jev API (verify against https://docs.typesafe.ai before relying on details)
- `POST {base}/v1/systemone`, `Authorization: Bearer $TYPESAFE_API_KEY`.
- Body: `{ model: "jev-latest", state: string|object, questions: { [id]: { type, instructions, criteria } } }`.
- Types: `choice` (criteria = { optionId: description }, 1–255 options),
  `score` (2–10 ordered levels), `noul` (yes/no).
- Response envelope (confirmed live against `jev-1.14.0`, 2026-10-31):
  `{ model: "jev-1.14.0", answers: { [questionId]: { type: "choice", choice, confidence, probabilities } }, usage: { input_tokens, output_tokens } }`.
  - `model` is the resolved version, not the requested alias (`jev-latest`).
  - `probabilities` has one entry per criteria option (zeros included); `confidence` is reported separately and is close to, but not always equal to, the chosen option's probability (0.95 vs 0.96 seen).
  - `usage` reports both input and output tokens (474 in / 69 out for a one-line brief + 6-option roster); only input is billed.
- `parseDecisionResponse` in `src/jev/parse.ts` validates this shape and throws on any mismatch. `DEBUG_JEV=1` logs the raw body.
  A recorded live response lives in `test/fixtures/jev-choice-response.json`; tests never call the API.

## Labelling briefs (`data/*.jsonl`)
When a brief fits several categories, the first matching rule wins:
1. `video` - the output must move (clips, loops, cinemagraphs, GIFs, animatics).
2. `fast-draft` - the user explicitly trades quality for speed, volume or low stakes.
3. `typography` - text must be legible in the image (titles, headlines, signs, brand names).
4. `product` - a single hero object on a studio or clean backdrop, even if stylized.
5. `photoreal` - real-world scenes, people, natural light (products in lifestyle settings land here).
6. `illustration` - drawn, painted or stylized art.

Borderline briefs carry a `note` explaining which rule decided. Briefs are English only.

## Measuring a change without overfitting
- `data/dev.jsonl` is for iterating: look at its misses freely.
- `data/test.jsonl` is held out. It was written blind to dev and to past results.
  Don't read its misses while iterating, don't tune against it, and never move briefs between splits.
  Score it only on a final candidate (or a small shortlist fixed in advance), against the current default in the same session.
- A change is a variant in `src/routing/variants.ts` (instructions + roster). `DEFAULT_VARIANT` is what routes use; `baseline` stays as the original reference.
- Run each config with `--repeats 3` (Jev's choices were stable across repeats, but its probabilities jitter by about ±0.01), then `npm run compare -- <default run> <candidate run>`.
  It prints paired deltas with bootstrap 95% CIs over briefs and an exact McNemar test on majority-vote correctness (a brief whose repeats tie has no majority and counts as wrong).
- Adopt a candidate only if, on test: log-loss improves (CI below 0), confident misses (wrong at >= 0.85) don't rise,
  and clear-brief accuracy drops by at most one brief.
- Label fixes are decided by the rules above, before seeing any run that uses them.
- Check a new brief set's difficulty with `npm run eval -- --router keyword --data <file>` (no API calls).
  The keyword router is a fixed, naive rule list; a set it scores highly on is too explicit to tell routers apart.
- `data/hard.jsonl` is a second held-out set (120 briefs, all hard, so every line has a `note`).
  Its deciding cues are implied, buried, corrected mid-brief or contradicted by surface words.
  It was written blind by one agent, relabelled blind by another (200/200 agreement), filtered to briefs both were sure of,
  and then to briefs the keyword router gets wrong, so its 9% keyword accuracy is by construction, not a difficulty measure.
  Same rules as `test.jsonl`: score it only on final candidates.

## Level 2: judging images
- `npm run generate` routes a fixed sample of dev briefs (10 per non-video category, seeded) and renders each with the routed model and the default model, locally through mflux (`uv tool install mflux`).
  `src/generation/local-lineup.ts` maps each placeholder category to a local model; `LOCAL_DEFAULT` is the single model routing has to beat.
  Output goes to `runs/level2/<timestamp>/` (images + `manifest.json`). Rerun with `--out <dir>` to resume an interrupted run.
- `npm run judge -- <dir>` serves a blind judging page on localhost. Sides are hidden and fixed per pair; picks go to `<dir>/judgments.jsonl`.
  Only pairs where routing picked a different model are judged. Video is left out: the default image model can't make video.
- `npm run judge-jev -- <dir>` has Jev judge every pair from the images (`src/judging/jev-judge.ts`), resuming past pairs it already judged.
  One request per pair asks in both orders and averages them, cancelling position bias; asset references and question ids are neutral so nothing reveals which image is routed.
  Images need the `TypeSafe-Danger-Zone-Images: true` header (the client adds it when assets are sent). They have returned brief 503s, so the CLI retries.
- `npm run judge-report -- <dir> [--judge jev]` prints the routed-model win rate (ties count half) with a bootstrap 95% CI, an exact sign test, and a per-category breakdown.
  For Jev it also prints agreement with hand judgments on shared pairs; trust Jev's win rate only as far as that agreement holds.
- Fix the sample and lineup before generating. Don't swap lineup models after seeing judgments and rejudge the same briefs.

## Conventions
- Never commit `.env`. The repo is public.
- Eval runs write timestamped JSON to `runs/` (gitignored) so results are reproducible.
- Keep README numbers in sync with the latest committed eval summary.
