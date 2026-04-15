/**
 * Shared types for the OCR layer.
 */

export type OcrCandidate = {
  /** Raw text the OCR provider thinks it saw. */
  text: string;
  /** Provider-reported confidence 0–1, if any. */
  confidence?: number;
  /** Optional bounding box in source-image px. */
  bbox?: { x: number; y: number; w: number; h: number };
};

export type OcrResult = {
  provider: "claude-vision" | "paddle" | "manual";
  candidates: OcrCandidate[];
  /** Total model / processing time in ms. */
  ms: number;
  /** Provider-reported model name / version if relevant. */
  model?: string;
};

export interface OcrProvider {
  name: OcrResult["provider"];
  /**
   * Extract app label candidates from a single frame (PNG/JPEG buffer).
   * Should NOT do fuzzy-matching — just return raw text candidates.
   */
  extract(image: Buffer): Promise<OcrResult>;
}
