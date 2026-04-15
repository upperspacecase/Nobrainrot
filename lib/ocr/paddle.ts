/**
 * PaddleOCR (PP-OCRv5 mobile) provider via `ppu-paddle-ocr`.
 *
 * Why this exists: the spec's privacy claim ("we never see your app list")
 * requires an offline OCR path. PaddleOCR runs fully in-process via ONNX
 * Runtime — no data leaves the server.
 *
 * Install as an optional extra (NOT in the base package.json because
 * onnxruntime-node ships ~40MB of native binaries that don't fit Vercel
 * serverless and are overkill for users who are OK with the hosted path):
 *
 *   npm install ppu-paddle-ocr onnxruntime-node
 *
 * Best run in a separate worker (Fly/Modal/Railway) rather than a Vercel
 * serverless function.
 */

import type { OcrCandidate, OcrProvider, OcrResult } from "./types";
import { extractLabelStrips } from "./preprocess";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PaddleOCR = any;

export class PaddleOcrProvider implements OcrProvider {
  name = "paddle" as const;
  private ocr: PaddleOCR | null = null;

  async init(): Promise<void> {
    if (this.ocr) return;
    let mod: { OCR: new () => PaddleOCR };
    try {
      // webpackIgnore: don't try to bundle the optional dep at build time.
      // @ts-expect-error — optional dependency, no types shipped.
      mod = await import(/* webpackIgnore: true */ "ppu-paddle-ocr");
    } catch (e) {
      throw new Error(
        `PaddleOCR provider requires the optional dependency "ppu-paddle-ocr". ` +
          `Install it with: npm install ppu-paddle-ocr onnxruntime-node\n` +
          `Original error: ${(e as Error).message}`,
      );
    }
    this.ocr = new mod.OCR();
    await this.ocr.init?.();
  }

  async extract(image: Buffer): Promise<OcrResult> {
    await this.init();
    const t0 = Date.now();

    // Per-icon cropping is the critical preprocessing step for PaddleOCR
    // on iOS labels. Full-screen input drops accuracy by 20–30%.
    const strips = await extractLabelStrips(image);

    const candidates: OcrCandidate[] = [];
    for (const strip of strips) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: Array<{ text: string; score?: number }> =
        (await this.ocr.detect?.(strip.buffer)) ?? [];
      for (const r of results) {
        if (!r.text) continue;
        candidates.push({
          text: r.text,
          confidence: r.score ?? 0.7,
          bbox: strip.bbox,
        });
      }
    }

    return {
      provider: "paddle",
      candidates,
      ms: Date.now() - t0,
      model: "PP-OCRv5-mobile",
    };
  }
}
