# Typecast

Pick the right image model for a creative brief — in ~150ms, with a confidence you can trust.

Built on decision models (TypeSafe's Jev and Jev-compatible open models) that return typed,
calibrated choices instead of text.

## Status
🚧 Level 1: measuring routing accuracy and calibration on labelled briefs.

## Quick start
```bash
cp .env.example .env        # add your TYPESAFE_API_KEY
npm install
npm run route -- "Hero image for a spring sneaker campaign, studio lighting"
npm run eval                # runs data/briefs.jsonl, prints accuracy + calibration
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

Results: _coming soon_.
