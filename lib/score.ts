/**
 * Scoring engine — applies rules to app metadata, assigns a tier.
 * See SPEC.md §5.3–§5.4.
 */

import type { ItunesApp } from "./itunes";
import { RULES, type Rule } from "./rules";

export type Tier = "DELETE" | "RECONSIDER" | "KEEP";

export type TriggeredRule = {
  id: string;
  name: string;
  weight: number;
  category: Rule["category"];
  reason: string;
};

export type ScoredApp = {
  name: string;
  bundleId: string;
  tier: Tier;
  score: number;
  triggered: TriggeredRule[];
  one_liner: string;
  genre: string;
};

const BENEFIT_OF_DOUBT_GENRES = new Set([
  "Education",
  "Health & Fitness",
  "Productivity",
  "Utilities",
]);

export function scoreApp(app: ItunesApp): ScoredApp {
  const triggered: TriggeredRule[] = [];
  let score = 0;
  let maxWeight = 0;

  for (const rule of RULES) {
    let fired = false;
    try {
      fired = rule.match(app);
    } catch {
      // Rule regex / predicate blew up on malformed metadata — skip.
      fired = false;
    }
    if (!fired) continue;
    triggered.push({
      id: rule.id,
      name: rule.name,
      weight: rule.weight,
      category: rule.category,
      reason: rule.reason,
    });
    score += rule.weight;
    if (rule.weight > maxWeight) maxWeight = rule.weight;
  }

  // Benefit-of-the-doubt adjustment.
  if (BENEFIT_OF_DOUBT_GENRES.has(app.primaryGenreName)) {
    score = Math.max(0, score - 2);
  }

  // Hardcoded overrides.
  const hasGamblingAdvisory = triggered.some((t) => t.id === "gambling_advisory");

  let tier: Tier;
  if (hasGamblingAdvisory) {
    tier = "DELETE";
  } else if (score >= 12 || maxWeight >= 8) {
    tier = "DELETE";
  } else if (score >= 5) {
    tier = "RECONSIDER";
  } else {
    tier = "KEEP";
  }

  // v1 one-liner: the highest-weight rule's reason (spec §5.4).
  const topRule = triggered.sort((a, b) => b.weight - a.weight)[0];
  const one_liner = topRule?.reason ?? "No slot mechanics detected.";

  return {
    name: app.trackName,
    bundleId: app.bundleId,
    tier,
    score,
    triggered: triggered.sort((a, b) => b.weight - a.weight),
    one_liner,
    genre: app.primaryGenreName,
  };
}

export function scoreMany(apps: ItunesApp[]): ScoredApp[] {
  return apps
    .map(scoreApp)
    .sort((a, b) => {
      // DELETE > RECONSIDER > KEEP, then by score desc
      const tierRank = { DELETE: 0, RECONSIDER: 1, KEEP: 2 } as const;
      const ra = tierRank[a.tier];
      const rb = tierRank[b.tier];
      if (ra !== rb) return ra - rb;
      return b.score - a.score;
    });
}

export function summarize(scored: ScoredApp[]) {
  return {
    total: scored.length,
    delete: scored.filter((s) => s.tier === "DELETE").length,
    reconsider: scored.filter((s) => s.tier === "RECONSIDER").length,
    keep: scored.filter((s) => s.tier === "KEEP").length,
    totalScore: scored.reduce((sum, s) => sum + s.score, 0),
  };
}
