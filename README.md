# Typecast

Pick the right image model for a creative brief — in ~200ms, with a confidence you can trust.

Built on decision models (TypeSafe's Jev and Jev-compatible open models) that return typed,
calibrated choices instead of text.

## Status
🚧 Level 1: measuring routing accuracy and calibration on labelled briefs.

## Quick start
```bash
cp .env.example .env        # add your TYPESAFE_API_KEY
npm install
npm run route -- "Hero image for a spring sneaker campaign, studio lighting"
npm run eval                # runs data/dev.jsonl, prints accuracy + calibration
npm run eval -- --data data/test.jsonl --variant baseline --repeats 3
npm run compare -- runs/<baseline>.json runs/<candidate>.json   # paired deltas + CIs
```

Point `TYPESAFE_BASE_URL` at a local Jev-compatible server (Kev, Laya, ...) to run without
the hosted API.

## How it's evaluated
| Metric | Question it answers |
|---|---|
| Accuracy | Does it pick the right model? |
| ECE (Expected Calibration Error) | When it says 90%, is it right 90% of the time? |
| p50 / p95 latency | How fast in practice? |
| Cost per 1,000 routes | What does it cost? |

Latest runs (2026-10-31, `jev-1.14.0`, default variant `priority`, 3 repeats each).
`dev` (120 briefs, 44 borderline) is the set we iterate on; `test` (120 briefs, 42 borderline) is held out and was written blind to dev.

| Metric | dev | test (held out) |
|---|---|---|
| Accuracy | 98.3% (100% clear, 95.5% borderline) | 100% |
| ECE | 0.035 | 0.031 |
| Log-loss | 0.062 | 0.029 |
| Confident misses (wrong at >= 0.85) | 0 | 0 |
| p50 / p95 latency | 199ms / 275ms | 199ms / 307ms |
| Cost per 1,000 routes | ~$0.026 | ~$0.026 |

Against the original `baseline` variant on the held-out set: accuracy 96.9% -> 100%, log-loss 0.124 -> 0.029, confident misses 2 -> 0.
The held-out set is now at ceiling, so the next step is a harder one built from real user briefs.
