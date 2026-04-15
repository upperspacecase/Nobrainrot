# Wireheading Audit

> Upload a screen recording of scrolling through your iOS apps. Get back a ranked kill list of apps using slot-machine mechanics, with reasons.

A Life-Time micro-tool. Anonymous, no signup, no data retention. **Tools to get you offline.**

---

## Status (v0.2)

| Piece | State |
|---|---|
| Landing page (+ Remotion demo) | ✅ shipped |
| Apps dictionary (fuzzy-match source) | ✅ 100-app hand-curated seed shipped; `npm run build:apps` fetches the full 1000-app list |
| Fuzzy matcher (Levenshtein + alias table + prefix) | ✅ |
| iTunes Search / Lookup client | ✅ |
| Scoring engine (14 rules, transparent rubric) | ✅ |
| OCR — Claude Vision provider (primary) | ✅ |
| OCR — PaddleOCR provider (optional, offline) | ✅ scaffolded, install `ppu-paddle-ocr` to enable |
| `/api/audit` — HTTP endpoint | ✅ accepts multipart image or JSON `{names}` |
| `audit` CLI | ✅ `npm run audit -- image.png` or `npm run audit -- --names "..."` |
| Video → frames pipeline (ffmpeg) | ⏳ next |
| Results UI wired to API | ⏳ next |

## Architecture

```
app/
  api/audit/route.ts          POST endpoint — image or name list in, scored JSON out
  page.tsx                    Landing page + embedded Remotion demo
data/
  apps.seed.json              Hand-curated 100-app fallback (committed)
  apps.json                   Full 1000-app list (generated via `npm run build:apps`)
lib/
  apps-dictionary.ts          Loads apps.json (falls back to seed)
  fuzzy-match.ts              Levenshtein + normalize + alias resolution
  itunes.ts                   iTunes Search / Lookup client (20 req/min limiter)
  rules.ts                    14 scoring rules — edit here to tune the rubric
  score.ts                    Apply rules → tier (DELETE / RECONSIDER / KEEP)
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

## What's next

- Video → frames pipeline (ffmpeg + pHash dedup) — the only piece between
  here and the spec's "drop a screen recording" UX.
- Wire the landing page "Audit my phone" button to the existing
  `/api/audit` endpoint (file input + result render).
- Share-link encoding (base64-gzipped JSON in URL hash).
