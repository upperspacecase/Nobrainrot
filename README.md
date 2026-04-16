# Wireheading Audit

> Upload a screen recording of scrolling through your iOS apps. Get back a ranked kill list of apps using slot-machine mechanics, with reasons.

A Life-Time micro-tool. Anonymous, no signup, no data retention. **Tools to get you offline.**

---

## Status (v0.3 — functional)

| Piece | State |
|---|---|
| Landing page (+ Remotion demo) | ✅ shipped |
| Apps dictionary (fuzzy-match source) | ✅ 100-app hand-curated seed shipped; `npm run build:apps` fetches the full 1000-app list |
| Fuzzy matcher (Levenshtein + alias table + prefix) | ✅ |
| iTunes Search / Lookup client | ✅ |
| Scoring engine (14 rules, transparent rubric) | ✅ |
| OCR — Claude Vision provider (primary) | ✅ |
| OCR — PaddleOCR provider (optional, offline) | ✅ scaffolded, install `ppu-paddle-ocr` to enable |
| Video → frames pipeline (ffmpeg + pHash dedup) | ✅ |
| `/api/audit` — HTTP endpoint | ✅ accepts video, image, or JSON `{names}` |
| `audit` CLI | ✅ `npm run audit -- image.png` or `--names "..."` |
| Landing page upload/paste UI wired to API | ✅ |
| Share link (URL-fragment, base64-gzip, no server) | ✅ |

## Architecture

```
app/
  api/audit/route.ts          POST endpoint — image or name list in, scored JSON out
  page.tsx                    Landing page + embedded Remotion demo
data/
  apps.seed.json              Hand-curated 100-app fallback (committed)
  apps.json                   Full 1000-app list (generated via `npm run build:apps`)
components/
  AuditForm.tsx               Upload/paste form, calls /api/audit, renders results
  AuditResults.tsx            Tiered list, expandable rules, share & reset buttons
  DemoPlayer.tsx              Remotion player wrapper
lib/
  apps-dictionary.ts          Loads apps.json (falls back to seed)
  fuzzy-match.ts              Levenshtein + normalize + alias resolution
  itunes.ts                   iTunes Search / Lookup client (20 req/min limiter)
  rules.ts                    14 scoring rules — edit here to tune the rubric
  score.ts                    Apply rules → tier (DELETE / RECONSIDER / KEEP)
  share.ts                    base64-gzip codec for URL-fragment share links
  video.ts                    ffmpeg frame extraction + 64-bit pHash dedup
  ocr/
    index.ts                  Orchestrator: provider → fuzzy → enrich → score
    claude-vision.ts          Claude Haiku 4.5 provider (uses icon context)
    paddle.ts                 PaddleOCR provider (offline / privacy mode)
    preprocess.ts             Per-icon cropping, upscale, invert, threshold (sharp)
    types.ts                  Provider interface
remotion/
  WireheadingDemo.tsx         26s composition
  scenes/                     Phone scroll → upload → processing → results
scripts/
  build-apps-dictionary.ts    One-shot: iTunes RSS + Lookup → data/apps.json
  audit-cli.ts                Local end-to-end runner
```

## Run

```bash
# install
npm install

# dev server (landing page + /api/audit)
npm run dev

# run the demo in Remotion Studio
npm run remotion

# build the full 1000-app dictionary (run once, commit the JSON)
npm run build:apps

# audit a screenshot end-to-end (needs ANTHROPIC_API_KEY for OCR)
ANTHROPIC_API_KEY=sk-ant-... npm run audit -- path/to/screenshot.png

# no OCR — just paste names and score (works offline)
npm run audit -- --names "Coin Master, TikTok, Candy Crush, Notes, Calculator"

# render the demo video
npm run render
```

## Pipeline

```
  image                                   list of strings
    │                                           │
    ▼                                           ▼
  OCR provider    ──────┐              fuzzy-match
  (claude-vision        │              (Levenshtein + alias + prefix
   or paddle)           │               against data/apps.json)
                        │                       │
                        └───── candidates ──────┤
                                                ▼
                                          bundleIds
                                                │
                                                ▼
                                     iTunes Lookup (batch-of-200)
                                                │
                                                ▼
                                     scoring engine (14 rules)
                                                │
                                                ▼
                                 ranked list (DELETE/RECONSIDER/KEEP)
```

Every score is a sum of triggered rule weights. Every triggered rule ships
with the human-readable reason it fired — shown in the UI and the CLI
output.

## OCR providers

### Claude Vision (default)
Claude Haiku 4.5 with a focused JSON-output system prompt. The model uses
icon context (a round red "S" icon + the caption → Snapchat) to recover
labels that pure-glyph OCR misses. ~$0.02/audit on a 60-frame video.
Set `ANTHROPIC_API_KEY`.

### PaddleOCR (optional, privacy-first)
Fully-local via `ppu-paddle-ocr` + `onnxruntime-node`. Not installed by
default — enable with:

```bash
npm install ppu-paddle-ocr onnxruntime-node
```

Best run in a separate worker (Fly/Modal/Railway), not a Vercel serverless
function. ~85% accuracy with per-icon cropping preprocessing baked in.

## Scoring rubric

Defined entirely in `lib/rules.ts`. Rules fire on app metadata from iTunes
Lookup. Current categories + weights:

| Category | Rules | Max weight |
|---|---|---|
| `slot` | gambling_advisory, casino_keywords, gacha_pattern, mystery_box | 10 |
| `feed` | short_video_feed, infinite_scroll_social, news_doomscroll | 7 |
| `streak` | streak_mechanic, energy_system | 5 |
| `currency` | dual_currency, aggressive_iap | 4 |
| `notif` | comeback_notifs | 4 |
| `time` | live_event_fomo | 5 |

Tier thresholds: `DELETE` ≥ 12 or any rule weight ≥ 8. `RECONSIDER` 5–11.
`KEEP` 0–4. Gambling advisory is an unconditional DELETE. Education /
Health & Fitness / Productivity / Utilities apps get a −2 score
adjustment (benefit of the doubt, spec §5.3).

## Privacy

No accounts. No tracking. Images are processed in memory — the `/api/audit`
route never writes to disk. No DB. Share links are URL-fragment-encoded
client-side. The repo is the source of truth.

## Video pipeline

`lib/video.ts` handles: ffmpeg → 1 fps PNG frames → 64-bit pHash dedup (Hamming ≤ 6 → duplicate) → hard cap at 40 unique frames.

A 60s iOS home-screen scroll typically yields 8–15 unique frames after dedup, which is what actually hits the OCR provider — keeping cost and latency down by roughly 4×.

The ffmpeg binary ships via `ffmpeg-static` (~40 MB). On Vercel serverless, this fits Pro's 250 MB function size, but Vercel's 4.5 MB request-body cap means full-size video uploads require one of:

1. Deploy the `/api/audit` route to a long-lived worker (Fly / Modal / Railway) and point the frontend at it.
2. Presign uploads to Vercel Blob / S3 from the browser, then pass the blob URL to `/api/audit` (minor route change).

For local `npm run dev`, the route handles 200 MB videos directly.

## What's next

- Vercel Blob / presigned upload flow so video works in prod serverless.
- Full 1000-app dictionary checked in (run `npm run build:apps` against real iTunes RSS).
- v2 "deeper analysis" tier via Claude Sonnet 4.6 (opt-in, per spec §9).
