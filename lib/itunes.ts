/**
 * iTunes Search / Lookup API client.
 *
 * Used at runtime to enrich matched apps with the fields needed for scoring:
 *   description, genres, advisories, formattedPrice, userRatingCount, etc.
 *
 * No auth. ~20 req/min per IP observed — we throttle with a tiny limiter.
 */

export type ItunesApp = {
  trackId: number;
  trackName: string;
  bundleId: string;
  primaryGenreName: string;
  genres: string[];
  description?: string;
  releaseNotes?: string;
  averageUserRating?: number;
  userRatingCount?: number;
  price?: number;
  formattedPrice?: string;
  screenshotUrls?: string[];
  advisories?: string[];
  contentAdvisoryRating?: string;
  artistName?: string;
};

/**
 * Minimal p-limit — concurrency guard without a dependency.
 */
function makeLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    if (active >= concurrency) return;
    const job = queue.shift();
    if (!job) return;
    active++;
    job();
  };
  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
}

const limit = makeLimiter(5);

export async function lookupByBundleId(
  bundleId: string,
): Promise<ItunesApp | null> {
  return limit(async () => {
    const url = `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(
      bundleId,
    )}&country=us`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as { results: ItunesApp[] };
    return json.results?.[0] ?? null;
  });
}

export async function lookupByBundleIds(
  bundleIds: string[],
): Promise<Map<string, ItunesApp>> {
  const out = new Map<string, ItunesApp>();
  if (bundleIds.length === 0) return out;

  // Batch up to 200 per call.
  const batches: string[][] = [];
  for (let i = 0; i < bundleIds.length; i += 200) {
    batches.push(bundleIds.slice(i, i + 200));
  }

  await Promise.all(
    batches.map((batch) =>
      limit(async () => {
        const url = `https://itunes.apple.com/lookup?bundleId=${batch
          .map(encodeURIComponent)
          .join(",")}&country=us`;
        const res = await fetch(url);
        if (!res.ok) return;
        const json = (await res.json()) as { results: ItunesApp[] };
        for (const app of json.results ?? []) {
          if (app.bundleId) out.set(app.bundleId, app);
        }
      }),
    ),
  );

  return out;
}

export async function search(
  term: string,
  opts: { limit?: number } = {},
): Promise<ItunesApp[]> {
  return limit(async () => {
    const url =
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}` +
      `&entity=software&limit=${opts.limit ?? 3}&country=us`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as { results: ItunesApp[] };
    return json.results ?? [];
  });
}
