/**
 * Fuzzy matching for OCR output → known app names.
 *
 * We don't pull in a dependency for Levenshtein — a ~30-line DP implementation
 * is faster than a library call for our string lengths (max ~25 chars) and
 * lets us keep the bundle small.
 */

/**
 * Levenshtein distance (iterative DP, O(n·m) time, O(min(n,m)) space).
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // always iterate the shorter string in the inner loop
  if (a.length > b.length) [a, b] = [b, a];

  const prev = new Array<number>(a.length + 1);
  const curr = new Array<number>(a.length + 1);
  for (let i = 0; i <= a.length; i++) prev[i] = i;

  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        curr[i - 1] + 1, // insertion
        prev[i] + 1, // deletion
        prev[i - 1] + cost, // substitution
      );
    }
    for (let i = 0; i <= a.length; i++) prev[i] = curr[i];
  }
  return prev[a.length];
}

/**
 * Normalized similarity in [0, 1]. 1 == identical.
 */
export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/**
 * Normalize a candidate name for matching:
 *   - lowercase
 *   - strip emoji / non-ASCII
 *   - collapse whitespace
 *   - strip trailing marketing suffixes after a dash/em-dash/bullet
 *   - strip common iOS label pollution ("...", "App", "®", "™")
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    // eslint-disable-next-line no-misleading-character-class
    .replace(/[\u0300-\u036f]/g, "") // combining marks
    .replace(/[®™©]/g, "")
    .replace(/\.{2,}/g, "") // ellipses
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "") // emoji ranges
    .replace(/\s*[—–\-·|:•].*$/u, "") // trim everything after a dash/bullet separator
    .replace(/[^\w\s&+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type MatchCandidate = {
  trackName: string;
  bundleId: string;
  primaryGenreName: string;
  genres?: string[];
};

export type Match = {
  candidate: MatchCandidate;
  score: number; // similarity 0–1
  via: "exact" | "alias" | "prefix" | "fuzzy";
};

/**
 * Best match for a single OCR'd name against the dictionary.
 *
 *   exact > alias > prefix-of-trackName > fuzzy (Levenshtein ≥ threshold)
 */
export function bestMatch(
  query: string,
  dictionary: MatchCandidate[],
  aliases: Record<string, string>,
  opts: { minSimilarity?: number } = {},
): Match | null {
  const minSim = opts.minSimilarity ?? 0.7;
  const q = normalize(query);
  if (q.length < 2) return null;

  // 1. exact normalized match
  for (const c of dictionary) {
    if (normalize(c.trackName) === q) {
      return { candidate: c, score: 1, via: "exact" };
    }
  }

  // 2. alias table
  const aliased = aliases[q];
  if (aliased) {
    const c = dictionary.find((d) => d.trackName === aliased);
    if (c) return { candidate: c, score: 0.95, via: "alias" };
  }

  // 3. prefix match (OCR often gets the first word right)
  let prefixHit: MatchCandidate | null = null;
  for (const c of dictionary) {
    const n = normalize(c.trackName);
    if (n.startsWith(q) || q.startsWith(n)) {
      if (!prefixHit || n.length < normalize(prefixHit.trackName).length) {
        prefixHit = c;
      }
    }
  }
  if (prefixHit) {
    const n = normalize(prefixHit.trackName);
    const score = Math.min(q.length, n.length) / Math.max(q.length, n.length);
    if (score >= 0.5) {
      return { candidate: prefixHit, score: 0.85 * score, via: "prefix" };
    }
  }

  // 4. fuzzy
  let best: Match | null = null;
  for (const c of dictionary) {
    const n = normalize(c.trackName);
    const s = similarity(q, n);
    if (s >= minSim && (!best || s > best.score)) {
      best = { candidate: c, score: s, via: "fuzzy" };
    }
  }
  return best;
}

/**
 * Batch version: resolve many OCR candidates against the dictionary at once,
 * de-duping by bundleId so the same app matched from multiple frames only
 * appears once in the output.
 */
export function matchMany(
  queries: string[],
  dictionary: MatchCandidate[],
  aliases: Record<string, string>,
  opts?: { minSimilarity?: number },
): { matched: Match[]; unmatched: string[] } {
  const matched = new Map<string, Match>();
  const unmatched: string[] = [];

  for (const q of queries) {
    const m = bestMatch(q, dictionary, aliases, opts);
    if (!m) {
      unmatched.push(q);
      continue;
    }
    const existing = matched.get(m.candidate.bundleId);
    if (!existing || m.score > existing.score) {
      matched.set(m.candidate.bundleId, m);
    }
  }

  return { matched: [...matched.values()], unmatched };
}
