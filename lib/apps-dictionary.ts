/**
 * Loads the apps dictionary from disk.
 *
 * Prefers `data/apps.json` (the full 1000-app list, built with
 * `npm run build:apps`) and falls back to `data/apps.seed.json` (the
 * hand-curated seed shipped with the repo).
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { MatchCandidate } from "./fuzzy-match";

export type AppsDictionary = {
  meta: { source: string; count: number; generated_at: string };
  apps: MatchCandidate[];
  aliases: Record<string, string>;
};

let cached: AppsDictionary | null = null;

export function loadAppsDictionary(): AppsDictionary {
  if (cached) return cached;

  const root = process.cwd();
  const full = join(root, "data", "apps.json");
  const seed = join(root, "data", "apps.seed.json");

  const path = existsSync(full) ? full : seed;
  const raw = JSON.parse(readFileSync(path, "utf8"));

  cached = {
    meta: raw._meta ?? { source: "unknown", count: 0, generated_at: "" },
    apps: raw.apps ?? [],
    aliases: raw.aliases ?? {},
  };
  return cached;
}
