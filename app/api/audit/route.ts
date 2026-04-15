/**
 * POST /api/audit
 *
 * Body (multipart/form-data):
 *   file: <image/png | image/jpeg>
 * OR JSON:
 *   { names: string[] }
 *
 * Response:
 *   { summary, scored, unmatched, ms }
 *
 * Runs server-side only. No data is persisted. Images are processed in
 * memory and discarded when the request ends.
 */

import { NextResponse, type NextRequest } from "next/server";
import { loadAppsDictionary } from "@/lib/apps-dictionary";
import { matchMany, type Match } from "@/lib/fuzzy-match";
import { auditImage } from "@/lib/ocr";
import { lookupByBundleIds, type ItunesApp } from "@/lib/itunes";
import { scoreMany, summarize } from "@/lib/score";

export const runtime = "nodejs";
// Give the pipeline enough headroom for OCR + iTunes round-trips.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const contentType = req.headers.get("content-type") ?? "";

  try {
    let matched: Match[] = [];
    let unmatched: string[] = [];
    let fromItunes: Match[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "missing file field" },
          { status: 400 },
        );
      }
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "image too large (max 10 MB for a single frame)" },
          { status: 413 },
        );
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const result = await auditImage(buf, { searchFallback: false });
      matched = result.matched;
      unmatched = result.unmatched;
      fromItunes = result.fromItunes;
    } else if (contentType.includes("application/json")) {
      const body = (await req.json()) as { names?: unknown };
      if (!Array.isArray(body.names)) {
        return NextResponse.json(
          { error: "body.names must be string[]" },
          { status: 400 },
        );
      }
      const names = body.names.filter(
        (n): n is string => typeof n === "string",
      );
      const dict = loadAppsDictionary();
      const r = matchMany(names, dict.apps, dict.aliases);
      matched = r.matched;
      unmatched = r.unmatched;
    } else {
      return NextResponse.json(
        { error: "expected multipart/form-data or application/json" },
        { status: 415 },
      );
    }

    const allMatches = [...matched, ...fromItunes];
    const bundleIds = allMatches.map((m) => m.candidate.bundleId);

    let enriched = new Map<string, ItunesApp>();
    try {
      enriched = await lookupByBundleIds(bundleIds);
    } catch {
      // iTunes flake — fall back to dictionary-only metadata.
    }

    const apps: ItunesApp[] = allMatches.map((m) => {
      const live = enriched.get(m.candidate.bundleId);
      if (live) return live;
      return {
        trackId: 0,
        trackName: m.candidate.trackName,
        bundleId: m.candidate.bundleId,
        primaryGenreName: m.candidate.primaryGenreName,
        genres: m.candidate.genres ?? [m.candidate.primaryGenreName],
      };
    });

    const scored = scoreMany(apps);
    const summary = summarize(scored);

    return NextResponse.json({
      summary,
      scored,
      unmatched,
      ms: Date.now() - t0,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
