/* eslint-disable no-console */
/**
 * Builds `data/apps.json` — the ~1000-app fuzzy-match dictionary.
 *
 * Sources:
 *   - Legacy iTunes RSS  (top-free / top-grossing, overall + per-genre × 200)
 *   - iTunes Lookup API (batch enrichment by trackId, up to 200 per call)
 *
 * Run:
 *   npm run build:apps
 *
 * Output:
 *   data/apps.json  — ~200KB, committed to the repo
 *
 * Rate limit: ~20 req/min per IP on the iTunes APIs (community-observed).
 * This script stays well under that.
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "data", "apps.json");
const SEED = join(ROOT, "data", "apps.seed.json");

// Apple genre ids we want to cover — picked for rubric coverage.
const GENRES: Array<{ id: number; label: string }> = [
  { id: 6014, label: "Games" },
  { id: 6005, label: "Social Networking" },
  { id: 6016, label: "Entertainment" },
  { id: 6007, label: "Productivity" },
  { id: 6008, label: "Photo & Video" },
  { id: 6002, label: "Utilities" },
  { id: 6012, label: "Lifestyle" },
  { id: 6024, label: "Shopping" },
  { id: 6023, label: "Food & Drink" },
  { id: 6017, label: "Education" },
  { id: 6013, label: "Health & Fitness" },
  { id: 6015, label: "Finance" },
  { id: 6009, label: "News" },
  { id: 6011, label: "Music" },
];

type RssEntry = {
  "im:name": { label: string };
  id: { attributes: { "im:bundleId"?: string; "im:id"?: string } };
  category?: { attributes: { term: string } };
};

type RssResponse = {
  feed?: { entry?: RssEntry[] };
};

type LookupResult = {
  trackId: number;
  trackName: string;
  bundleId: string;
  primaryGenreName: string;
  genres: string[];
};

async function fetchRss(
  chart: "topfreeapplications" | "topgrossingapplications",
  limit = 200,
  genre?: number,
): Promise<RssEntry[]> {
  const g = genre ? `/genre=${genre}` : "";
  const url = `https://itunes.apple.com/us/rss/${chart}/limit=${limit}${g}/json`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  [rss] ${chart}${g} → ${res.status}`);
    return [];
  }
  const json = (await res.json()) as RssResponse;
  return json.feed?.entry ?? [];
}

async function lookupBatch(trackIds: string[]): Promise<LookupResult[]> {
  if (trackIds.length === 0) return [];
  const url = `https://itunes.apple.com/lookup?id=${trackIds.join(",")}&country=us`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  [lookup] batch of ${trackIds.length} → ${res.status}`);
    return [];
  }
  const json = (await res.json()) as { results: LookupResult[] };
  return json.results ?? [];
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("fetching top charts…");

  const trackIds = new Set<string>();

  // overall top-free + top-grossing
  for (const chart of [
    "topfreeapplications",
    "topgrossingapplications",
  ] as const) {
    const entries = await fetchRss(chart, 200);
    entries.forEach((e) => {
      const id = e.id.attributes["im:id"];
      if (id) trackIds.add(id);
    });
    console.log(`  ${chart}: +${entries.length} (total ${trackIds.size})`);
    await sleep(4000);
  }

  // per-genre top-free × 14 genres × 200
  for (const g of GENRES) {
    const entries = await fetchRss("topfreeapplications", 200, g.id);
    const before = trackIds.size;
    entries.forEach((e) => {
      const id = e.id.attributes["im:id"];
      if (id) trackIds.add(id);
    });
    console.log(
      `  ${g.label.padEnd(20)} +${entries.length - (entries.length - (trackIds.size - before))} (total ${trackIds.size})`,
    );
    await sleep(4000);
  }

  console.log(`\nunique trackIds collected: ${trackIds.size}`);
  console.log("\nenriching via Lookup API (batches of 200)…");

  const results: LookupResult[] = [];
  const batches = chunk([...trackIds], 200);
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const got = await lookupBatch(batch);
    results.push(...got);
    console.log(`  batch ${i + 1}/${batches.length}: +${got.length}`);
    await sleep(4000);
  }

  // de-dupe by bundleId, prefer first occurrence
  const byBundle = new Map<string, LookupResult>();
  for (const r of results) {
    if (!r.bundleId || byBundle.has(r.bundleId)) continue;
    byBundle.set(r.bundleId, r);
  }

  // pull the alias map from the seed so hand-curated abbreviations survive
  let aliases: Record<string, string> = {};
  if (existsSync(SEED)) {
    try {
      const seed = JSON.parse(readFileSync(SEED, "utf8"));
      aliases = seed.aliases ?? {};
    } catch {
      /* ignore */
    }
  }

  const apps = [...byBundle.values()]
    .map((r) => ({
      trackName: r.trackName,
      bundleId: r.bundleId,
      primaryGenreName: r.primaryGenreName,
      genres: r.genres,
    }))
    .sort((a, b) => a.trackName.localeCompare(b.trackName));

  const output = {
    _meta: {
      source: "iTunes RSS + Lookup API",
      count: apps.length,
      generated_at: new Date().toISOString().slice(0, 10),
    },
    apps,
    aliases,
  };

  if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(output, null, 2));
  const kb = (Buffer.byteLength(JSON.stringify(output)) / 1024).toFixed(1);
  console.log(`\n→ wrote ${apps.length} apps to ${OUT} (${kb} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
