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
Dependencies point inward, and `npm run lint` enforces it (`ALLOWED_IMPORTS` in `eslint.config.js`):
`cli/` -> `demo/` -> `judging/` -> `generation/` -> `evaluation/` -> `routing/` -> `jev/` -> `shared/`.
`comparison/` sits beside `generation/` (it reads `evaluation/` runs), and `judging/` also talks to `jev/` directly for the Jev judge.
`locating/` sits beside `routing/` (it talks to `jev/`), and `demo/` uses it through the `Locator` interface.
`hosting/` sits beside `demo/` and reuses its handlers for the hosted site; `api/` (Vercel functions) is a composition root like `cli/`.
Nothing below `cli/` and `api/` reads `process.env`.

| Module | Responsibility |
|---|---|
| `shared/` | Product-free helpers: seeded PRNG and paired statistics, JSON field validation, HTTP plumbing for the local servers, short hashes, cost and percent formatting |
| `jev/parse.ts` | Wire types and strict response validation |
| `jev/answers.ts` | Checks an answer against the question asked: present, a valid choice, one probability per option |
| `jev/client.ts` | `DecisionClient` interface; HTTP implementation with injected config, `fetch` and clock |
| `routing/` | `Router` interface, the decision-model router, the pick-or-compare recommendation, the keyword difficulty probe, roster and variants |
| `locating/` | `Locator` interface and the Jev locator (a box and a presence check per image, every image at once), fitting images to Jev's size limits, the padded square crop |
| `evaluation/` | Briefs, pure metrics, metric registry, runner, summary, report formatting, run store |
| `comparison/` | Run comparison and report formatting |
| `generation/` | `Generator` interface, the mflux adapter, the local lineup, fixed brief sample, pair runner, shootout runner (every lineup model on every brief), manifest store |
| `judging/` | `PairJudge` interface and the Jev judge, `PickJudge` (best of N) and the Jev picker, picks store, pick summary and contact sheet, judgments store (append-only, with undo rows), blind side and order, win-rate statistics, report formatting, the local judging server and page |
| `demo/` | Local demo server and page: live route, pick-or-compare recommendation, local render, compare with the default model and have the judge pick, latest eval evidence, latest judged shootout. A second page finds a described target in several images and crops around it in each. Images, routes, judgments and boxes are cached on disk under `runs/demo/`. Also the results showcase page, and page paths for local and hosted |
| `hosting/` | The hosted site's API: the demo's route and locate handlers as serverless request handlers |
| `cli/` | Composition roots: read env and args, wire implementations, print |
| `api/` | Vercel functions: read env and serve `hosting/`'s handlers |

SOLID, and where it lives:
- **S** - one reason to change per module: parsing vs answer checking vs transport (`jev/`), running vs summarising vs formatting vs storing (`evaluation/`), computing vs printing (`comparison/`, `judging/`).
- **O** - extend by adding entries, not editing code: a metric is one entry in `RUN_METRICS` (summary and compare pick it up), a routing change is one entry in `VARIANTS`, a new auto-judge is a new `PairJudge` or `PickJudge`.
- **L** - any implementation can stand in for another of its interface. Contracts: `test/jev/decision-client.contract.ts` (HTTP client and test fake) `test/routing/router.contract.ts` (decision and keyword routers) `test/judging/pick-judge.contract.ts` (Jev picker) and `test/locating/locator.contract.ts` (Jev locator). A new implementation must pass its contract too.
- **I** - small interfaces: `Router` has only `route`, `DecisionClient` only `decide`, `PairJudge` only `judge`, `PickJudge` only `pick`, `Locator` only `locate`; metrics take the narrowest prediction type they need.
- **D** - high-level code depends on abstractions: `runEval` takes a `Router`, the router takes a `DecisionClient`, the demo and `autoJudgeRun` take a `PairJudge`, the demo takes a `Locator`, the client takes config and `fetch`. Only `cli/` picks implementations.

Clean Code conventions: intention-revealing names, small single-purpose functions, named constants instead of magic numbers, errors that name the offending field, and comments only for the "why".

## Keeping it clean
`npm run check` is the gate: typecheck, lint (including module layering, complexity and function size), dead code (knip), duplication (jscpd) and tests.
It runs on every commit (`.githooks/pre-commit`, installed by `npm install`). A Claude Code hook typechecks and lints each edited file.
When a check fails, fix the code; loosen a rule only when the rule is wrong, and say why in `eslint.config.js`.

Rules the checks can't enforce:
- Before writing a helper, look in `src/shared/` and the module you're in. Extend what exists rather than adding a near-copy.
- A new interface gets a contract test that every implementation runs (see `test/routing/router.contract.ts`).
- A bug fix starts with a test that fails for the reason the user saw.
- Delete code you replace. No commented-out code, no unused options "for later", no wrappers that only rename.
- Write a comment only when the code can't say why. Never narrate what the next line does.
- Match the surrounding code's naming and idiom. A change should read as if the same person wrote the whole file.

## Jev API (verify against https://docs.typesafe.ai before relying on details)
- `POST {base}/v1/systemone`, `Authorization: Bearer $TYPESAFE_API_KEY`.
- Body: `{ model: "jev-latest", state: string|object, questions: { [id]: { type, instructions, criteria } } }`.
- Types: `choice` (criteria = { optionId: description }, 1–255 options),
  `score` (2–10 ordered levels), `noul` (yes/no), `box` (where something is in an image; no criteria).
  The client parses `choice`, `box` and `noul` answers; `score` isn't used yet.
- Response envelope (confirmed live against `jev-1.14.0`, 2026-10-31):
  `{ model: "jev-1.14.0", answers: { [questionId]: { type: "choice", choice, confidence, probabilities } }, usage: { input_tokens, output_tokens } }`.
  - `model` is the resolved version, not the requested alias (`jev-latest`).
  - `probabilities` has one entry per criteria option (zeros included); `confidence` is reported separately and is close to, but not always equal to, the chosen option's probability (0.95 vs 0.96 seen).
  - `usage` reports both input and output tokens (474 in / 69 out for a one-line brief + 6-option roster); only input is billed.
- Box and noul answers (confirmed live against `jev-1.14.0`, 2026-11-01): `{ type: "box", box: { top, bottom, left, right }, confidence }` with edges as fractions of the image from its top-left corner,
  and `{ type: "noul", noul }`, the probability of yes. A box question needs an image and the images header.
  A box always comes back, even when the target is missing, so ask a noul question alongside it.
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
  Hand judging and Jev can write to the same `judgments.jsonl` at once: the file is append-only, and Undo in the judging page appends an undo row that takes back only the human's last pick.
  One request per pair asks in both orders and averages them, cancelling position bias; asset references and question ids are neutral so nothing reveals which image is routed.
  Images need the `TypeSafe-Danger-Zone-Images: true` header (the client adds it when assets are sent). They have returned brief 503s, so the CLI retries.
- `npm run judge-report -- <dir> [--judge jev]` prints the routed-model win rate (ties count half) with a bootstrap 95% CI, an exact sign test, and a per-category breakdown.
  For Jev it also prints agreement with hand judgments on shared pairs; trust Jev's win rate only as far as that agreement holds.
- `npm run generate -- --shootout` renders every brief of the sample with every lineup model (same prompt and seed) into `runs/shootout/<timestamp>/shootout.json`.
  `npm run pick-jev -- <dir>` has Jev pick the best image of each brief (`src/judging/jev-picker.ts`), appending to `<dir>/picks.jsonl` and resuming past briefs it picked under the same prompt.
  One request per brief asks once per rotation of the images' order, so every image is shown once in every position; probabilities are averaged and `agreement` is the share of rotations that chose the pick.
  The images sit in the state once and questions refer to them by path: Jev sends an image again for every question whose text contains its asset reference, even inside a longer string, and five 1024px images that way overflowed the 32k per-question context.
  From the state, five cost about 15k input tokens.
  It prints how often the best image came from the routed model, the expected category's model and the default, against chance (1 / models), and writes `<dir>/picks.html`, a contact sheet for checking the picks by eye.
  The demo shows the newest shootout run the picker has picked, brief by brief.
  Nothing has measured the picker against people yet, so treat its picks as Jev's opinion, not ground truth.
- `npm run site` builds the hosted site into `site/`: the results showcase at `/` (held-out routing numbers and every brief of the newest picked shootout, images as JPEG), live routing at `/demo` and find and crop at `/locate`, plus the routing page's config as a static file.
  Hosted, there is no Mac to render on, so `/demo` routes but hides render, compare and judge.
  It also bakes the committed samples' answers for the default target into `build/locate-answers/` (kept between builds, so only new samples cost a Jev call), so trying the samples costs nothing.

## Hosting (Vercel)
- The project is `typecast` (typecast-six.vercel.app), linked at the repo root. `vercel deploy` makes a preview behind Vercel login; `vercel deploy --prod` publishes. Build the site first: Vercel runs no build.
- `.vercelignore` is an allowlist: the CLI uploads the working folder, and `.env`, `.env.local` and `runs/` (with images that aren't ours) must never go up.
- Functions in `api/` run the `src/` TypeScript directly on Node 26; `vercel.json` ships `src/`, the samples and the baked answers beside them. A file in `api/` whose name starts with `_` isn't served.
- `TYPESAFE_API_KEY` is set in the project for Production and Preview. Live calls are not capped.
- A function takes at most 4.5 MB a request, so the find-and-crop page shrinks uploads to 1568px JPEG before sending; boxes and crops come from that copy.
- Fix the sample and lineup before generating. Don't swap lineup models after seeing judgments and rejudge the same briefs.

## Finding and cropping
- The demo's `/locate` page finds one target in up to `MAX_IMAGES` images at once (`src/locating/locator.ts`): one request per image, all in parallel, each with a box question for where the target is and a noul question for whether it is there.
  Don't batch images into one request: eight in one request cost the same tokens but loosened the boxes (a cyclist's face came back as a body-height strip at 0.23 confidence, against a tight box at 0.82 alone).
  `squareCrop` pads the box on every side by a share of its longer edge and keeps the square centred on the box, even past the image's edge (that part of the crop is transparent); sliding it back inside pushed faces off-centre.
  The crop is cut from the original, not the copy sent to Jev.
- Images are scaled to fit Jev's 280-1568px sides and sent as JPEG; the box's fractions apply to the original because the aspect ratio is kept.
  Send JPEG, not PNG: uploading a 3.7 MB PNG took about 1s of a 1.3s request, while the same image as a 0.23 MB JPEG took 0.35s with the same box and tokens.
- About one in nine image requests fired together gets a 503 ("Image processing is unavailable") while the rest answer, so the locator retries after 250ms, not judging's 1.5s; the time it reports includes retries.
- The page gets each crop as a WebP preview of at most 520px (`previewOf`): full-size PNG crops made one response 13 MB and took the browser seconds to decode.
- Samples live in `data/locating/` (rendered locally with mflux, so they are ours to commit). A 1024x1280 photo costs about 3,700 input tokens.
  Images that aren't ours to publish (such as a third-party example photo) go in `runs/locating-samples/`, which is gitignored; the demo lists both folders.
- Nothing has measured box accuracy yet. Box is marked "Dreamer-ready" in Jev's docs, so its format and quality can change between releases.

## Conventions
- Never commit `.env`. The repo is public.
- Eval runs write timestamped JSON to `runs/` (gitignored) so results are reproducible.
- Keep README numbers in sync with the latest committed eval summary.
