# Wireheading Audit

> Upload a screen recording of scrolling through your iOS apps. Get back a ranked kill list of apps using slot-machine mechanics, with reasons.

A Life-Time micro-tool. Anonymous, no signup, no data retention. **Tools to get you offline.**

---

## What's in this repo (v0.1)

This is the landing page + a Remotion demo of the flow. The audit pipeline itself is specced out in `SPEC.md` and shipping next.

- `app/` — Next.js 14 landing page (black, monospace, diagnostic feel)
- `components/DemoPlayer.tsx` — embeds the Remotion player inline
- `remotion/` — the demo composition
  - `WireheadingDemo.tsx` — root composition (26s @ 30fps)
  - `scenes/PhoneScrollScene.tsx` — stylized iPhone scrolling through apps
  - `scenes/UploadScene.tsx` — file-drop animation
  - `scenes/ProcessingScene.tsx` — four processing steps + live OCR ticker
  - `scenes/ResultsScene.tsx` — DELETE / RECONSIDER / KEEP ranked list

## Run

```bash
npm install
npm run dev          # landing page with embedded demo → http://localhost:3000
npm run remotion     # Remotion Studio (edit the composition live)
npm run render       # render the demo to out/demo.mp4
```

## Privacy claim

No accounts. No tracking. Your video is processed in memory and discarded the moment the request ends. We never see your app list. Source is open.
