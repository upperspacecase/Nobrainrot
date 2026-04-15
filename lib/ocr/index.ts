/**
 * OCR orchestration.
 *
 * Pipeline per image:
 *   1. Provider extracts raw text candidates
 *   2. Candidates are normalized + fuzzy-matched against the bundled
 *      apps dictionary (~100–1000 apps)
 *   3. Unmatched candidates fall back to a live iTunes Search lookup
 *      (if enabled) — handy for long-tail apps not in the dictionary
 *   4. Output: deduped list of matched apps with bundleId + trackName
 */

import { loadAppsDictionary } from "../apps-dictionary";
import { matchMany, normalize, type Match } from "../fuzzy-match";
import { search as itunesSearch } from "../itunes";
import { ClaudeVisionProvider } from "./claude-vision";
import { PaddleOcrProvider } from "./paddle";
import type { OcrProvider, OcrResult } from "./types";

export type AuditOcrResult = {
  raw: OcrResult;
  matched: Match[];
  unmatched: string[];
  /** Apps found via iTunes Search fallback (outside the dictionary). */
  fromItunes: Match[];
};

export type OcrPipelineOptions = {
  /** Which provider to use. Default: claude-vision if ANTHROPIC_API_KEY is set, else throws. */
  provider?: "claude-vision" | "paddle";
  /** If true, query iTunes Search for candidates that didn't fuzzy-match. Default: false. */
  searchFallback?: boolean;
  /** Min Levenshtein similarity for a fuzzy match. Default: 0.7. */
  minSimilarity?: number;
};

export function getProvider(
  name: OcrPipelineOptions["provider"],
): OcrProvider {
  const selected =
    name ?? (process.env.ANTHROPIC_API_KEY ? "claude-vision" : "paddle");
  switch (selected) {
    case "claude-vision":
      return new ClaudeVisionProvider();
    case "paddle":
      return new PaddleOcrProvider();
    default:
      throw new Error(`Unknown OCR provider: ${selected}`);
  }
}

export async function auditImage(
  image: Buffer,
  opts: OcrPipelineOptions = {},
): Promise<AuditOcrResult> {
  const provider = getProvider(opts.provider);
  const raw = await provider.extract(image);

  const dict = loadAppsDictionary();
  const texts = raw.candidates.map((c) => c.text);

  const { matched, unmatched } = matchMany(texts, dict.apps, dict.aliases, {
    minSimilarity: opts.minSimilarity,
  });

  const fromItunes: Match[] = [];
  if (opts.searchFallback && unmatched.length > 0) {
    const seen = new Set(matched.map((m) => m.candidate.bundleId));
    for (const q of unmatched) {
      const n = normalize(q);
      if (n.length < 3) continue;
      const hits = await itunesSearch(n, { limit: 1 });
      const top = hits[0];
      if (!top || !top.bundleId || seen.has(top.bundleId)) continue;
      // Sanity check: don't trust an iTunes hit unless its name is plausibly close.
      const { bestMatch } = await import("../fuzzy-match");
      const sim = bestMatch(q, [top], {}, { minSimilarity: 0.55 });
      if (!sim) continue;
      fromItunes.push(sim);
      seen.add(top.bundleId);
    }
  }

  return { raw, matched, unmatched, fromItunes };
}

/**
 * Audit a list of frames (video dedup → per-frame OCR → union).
 * Useful once the video extractor lands.
 */
export async function auditFrames(
  frames: Buffer[],
  opts: OcrPipelineOptions = {},
): Promise<{
  perFrame: AuditOcrResult[];
  union: Match[];
}> {
  const perFrame: AuditOcrResult[] = [];
  for (const f of frames) {
    perFrame.push(await auditImage(f, opts));
  }
  const byBundle = new Map<string, Match>();
  for (const r of perFrame) {
    for (const m of [...r.matched, ...r.fromItunes]) {
      const existing = byBundle.get(m.candidate.bundleId);
      if (!existing || m.score > existing.score) {
        byBundle.set(m.candidate.bundleId, m);
      }
    }
  }
  return { perFrame, union: [...byBundle.values()] };
}
