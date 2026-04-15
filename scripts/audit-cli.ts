/* eslint-disable no-console */
/**
 * End-to-end audit CLI.
 *
 * Takes a screenshot path (PNG/JPEG) and runs the full pipeline:
 *   OCR → fuzzy-match dictionary → iTunes enrichment → rule-based scoring
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/audit-cli.ts ~/screenshot.png
 *
 *   # Or skip OCR and just feed a list of names you already know:
 *   npx tsx scripts/audit-cli.ts --names "Coin Master, TikTok, Notes, Calculator"
 *
 *   # Use the Paddle (offline) provider:
 *   npx tsx scripts/audit-cli.ts --provider paddle ~/screenshot.png
 *
 *   # Query iTunes Search for anything the dictionary missed:
 *   npx tsx scripts/audit-cli.ts --search-fallback ~/screenshot.png
 */

import { readFileSync, existsSync } from "node:fs";
import { loadAppsDictionary } from "../lib/apps-dictionary";
import { matchMany, type Match } from "../lib/fuzzy-match";
import { auditImage } from "../lib/ocr";
import { lookupByBundleIds, type ItunesApp } from "../lib/itunes";
import { scoreMany, summarize } from "../lib/score";

type Args = {
  imagePath?: string;
  names?: string[];
  provider?: "claude-vision" | "paddle";
  searchFallback: boolean;
  json: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { searchFallback: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--names") {
      args.names = argv[++i]
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === "--provider") {
      args.provider = argv[++i] as "claude-vision" | "paddle";
    } else if (a === "--search-fallback") {
      args.searchFallback = true;
    } else if (a === "--json") {
      args.json = true;
    } else if (!a.startsWith("--")) {
      args.imagePath = a;
    }
  }
  return args;
}

function color(s: string, c: string): string {
  const codes: Record<string, string> = {
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    dim: "\x1b[2m",
    bold: "\x1b[1m",
    reset: "\x1b[0m",
    accent: "\x1b[38;2;124;255;178m",
  };
  return `${codes[c] ?? ""}${s}${codes.reset}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.imagePath && !args.names) {
    console.error(
      "usage: audit-cli <image.png>                # OCR + audit\n" +
        "       audit-cli --names \"App A, App B\"    # skip OCR\n" +
        "       audit-cli --provider paddle <image> # offline OCR\n" +
        "       audit-cli --search-fallback <image> # widen match via iTunes\n" +
        "       audit-cli --json <image>            # JSON output\n",
    );
    process.exit(1);
  }

  const dict = loadAppsDictionary();
  console.error(
    color(
      `dictionary: ${dict.apps.length} apps  ${color(
        `(${dict.meta.source})`,
        "dim",
      )}`,
      "dim",
    ),
  );

  // ── 1. get candidate app names ──
  let matched: Match[] = [];
  let unmatched: string[] = [];
  let fromItunes: Match[] = [];
  const t0 = Date.now();

  if (args.names) {
    const r = matchMany(args.names, dict.apps, dict.aliases);
    matched = r.matched;
    unmatched = r.unmatched;
    console.error(
      color(
        `input: ${args.names.length} names (--names mode, no OCR)\n`,
        "dim",
      ),
    );
  } else {
    const path = args.imagePath!;
    if (!existsSync(path)) {
      console.error(color(`error: file not found: ${path}`, "red"));
      process.exit(1);
    }
    const image = readFileSync(path);
    console.error(color(`ocr: extracting labels from ${path}…`, "dim"));

    try {
      const result = await auditImage(image, {
        provider: args.provider,
        searchFallback: args.searchFallback,
      });
      matched = result.matched;
      unmatched = result.unmatched;
      fromItunes = result.fromItunes;
      console.error(
        color(
          `ocr: ${result.raw.candidates.length} candidates via ${result.raw.provider} (${result.raw.ms}ms)`,
          "dim",
        ),
      );
    } catch (e) {
      console.error(color(`ocr failed: ${(e as Error).message}`, "red"));
      process.exit(1);
    }
  }

  console.error(
    color(
      `match:  ${matched.length} from dictionary, ${fromItunes.length} from iTunes, ${unmatched.length} unmatched\n`,
      "dim",
    ),
  );

  // ── 2. enrich via iTunes Lookup ──
  const allMatches = [...matched, ...fromItunes];
  const bundleIds = allMatches.map((m) => m.candidate.bundleId);
  console.error(
    color(`enrich: lookup ${bundleIds.length} apps via iTunes…`, "dim"),
  );

  let enriched;
  try {
    enriched = await lookupByBundleIds(bundleIds);
  } catch (e) {
    console.error(
      color(
        `warn: iTunes enrichment failed (${(e as Error).message}) — scoring on minimal metadata`,
        "yellow",
      ),
    );
    enriched = new Map();
  }

  // Merge dictionary-known apps with iTunes-fetched metadata.
  const apps = allMatches.map((m) => {
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

  // ── 3. score ──
  const scored = scoreMany(apps);
  const summary = summarize(scored);
  const totalMs = Date.now() - t0;

  if (args.json) {
    console.log(
      JSON.stringify(
        { summary, scored, unmatched, ms: totalMs },
        null,
        2,
      ),
    );
    return;
  }

  // ── 4. print ──
  console.log();
  console.log(
    color(
      `── Wireheading Audit ── ${summary.delete}/${summary.total} flagged DELETE  ·  total score ${summary.totalScore}  ·  ${totalMs}ms`,
      "bold",
    ),
  );
  console.log();

  for (const tier of ["DELETE", "RECONSIDER", "KEEP"] as const) {
    const apps = scored.filter((s) => s.tier === tier);
    if (apps.length === 0) continue;
    const tierColor = tier === "DELETE" ? "red" : tier === "RECONSIDER" ? "yellow" : "green";
    console.log(color(`[ ${tier} ]`, tierColor) + color(` ${apps.length}`, "dim"));
    for (const a of apps) {
      const scoreStr = color(String(a.score).padStart(3), tierColor);
      console.log(`  ${scoreStr}  ${a.name}  ${color(`(${a.genre})`, "dim")}`);
      for (const t of a.triggered) {
        console.log(
          color(`        · [${t.weight}] ${t.reason}`, "dim"),
        );
      }
    }
    console.log();
  }

  if (unmatched.length > 0) {
    console.log(color(`unmatched OCR candidates (${unmatched.length}):`, "dim"));
    console.log(
      color(
        unmatched.map((u) => `"${u}"`).join(", "),
        "dim",
      ),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
