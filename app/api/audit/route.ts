/**
 * POST /api/audit
 *
 * Body (multipart/form-data):
 *   file: <image/png | image/jpeg | video/mp4 | video/quicktime | video/webm>
 * OR JSON:
 *   { names: string[] }
 *
 * Response:
 *   { summary, scored, unmatched, ms, frames? }
 *
 * Runs server-side only. No data is persisted. Uploads are processed in
 * memory and discarded when the request ends.
 *
 * Vercel note: serverless request bodies are capped around 4.5 MB. Full
 * videos need a blob/presigned-upload flow in production — see README.
 */

import { NextResponse, type NextRequest } from "next/server";
import { loadAppsDictionary } from "@/lib/apps-dictionary";
import { matchMany, type Match } from "@/lib/fuzzy-match";
import { auditImage, auditFrames } from "@/lib/ocr";
import { lookupByBundleIds, type ItunesApp } from "@/lib/itunes";
import { scoreMany, summarize } from "@/lib/score";
import { extractFrames, isVideo } from "@/lib/video";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const contentType = req.headers.get("content-type") ?? "";

  try {
    let matched: Match[] = [];
    let unmatched: string[] = [];
    let fromItunes: Match[] = [];
    let framesUsed: number | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "missing file field" },
          { status: 400 },
        );
      }

      const buf = Buffer.from(await file.arrayBuffer());
      const looksLikeVideo = isVideo(buf);

      if (looksLikeVideo) {
        if (buf.length > MAX_VIDEO_BYTES) {
          return NextResponse.json(
            { error: "video too large (max 200 MB)" },
            { status: 413 },
          );
        }
        const frames = await extractFrames(buf, { fps: 1, maxFrames: 40 });
        framesUsed = frames.length;
        const result = await auditFrames(
          frames.map((f) => f.buffer),
          { searchFallback: false },
        );
        matched = result.union;
        unmatched = [];
        fromItunes = [];
      } else {
        if (buf.length > MAX_IMAGE_BYTES) {
          return NextResponse.json(
            { error: "image too large (max 10 MB)" },
            { status: 413 },
          );
        }
        const result = await auditImage(buf, { searchFallback: false });
        matched = result.matched;
        unmatched = result.unmatched;
        fromItunes = result.fromItunes;
        framesUsed = 1;
      }
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
      frames: framesUsed,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
