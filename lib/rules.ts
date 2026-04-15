/**
 * Scoring rules. Every score is a sum of triggered rules — transparent by
 * design. If you want to tune the rubric, this is the only file to change.
 *
 * Source of truth: SPEC.md §5.2.
 */

import type { ItunesApp } from "./itunes";

export type RuleCategory =
  | "slot"
  | "feed"
  | "streak"
  | "currency"
  | "notif"
  | "time";

export type Rule = {
  id: string;
  name: string;
  weight: number;
  category: RuleCategory;
  match: (app: ItunesApp) => boolean;
  /** Human-readable reason when the rule fires. */
  reason: string;
};

// ───────────── helpers ─────────────

const GAMES = (a: ItunesApp) =>
  a.primaryGenreName === "Games" || (a.genres ?? []).includes("Games");

const SOCIAL = (a: ItunesApp) =>
  a.primaryGenreName === "Social Networking" ||
  (a.genres ?? []).includes("Social Networking");

const haystack = (a: ItunesApp) =>
  [a.trackName, a.description, a.releaseNotes, (a.genres ?? []).join(" ")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const hasIAP = (a: ItunesApp) => {
  const s = (a.description ?? "") + " " + (a.releaseNotes ?? "");
  return (
    /in-?app\s+purchase/i.test(s) ||
    (a.formattedPrice === "Free" && GAMES(a))
  );
};

const bundleIdIn = (ids: string[]) => (a: ItunesApp) =>
  ids.includes(a.bundleId);

// ───────────── rules ─────────────

export const RULES: Rule[] = [
  // ── Slot-mechanic (highest weight) ──
  {
    id: "gambling_advisory",
    name: "Gambling advisory",
    weight: 10,
    category: "slot",
    match: (a) =>
      (a.advisories ?? []).some((x) => /gambling/i.test(x)),
    reason: "App Store advisory flags gambling or simulated gambling.",
  },
  {
    id: "casino_keywords",
    name: "Casino / slot keywords",
    weight: 9,
    category: "slot",
    match: (a) =>
      /\b(slots?|casino|jackpot|spin|bingo|poker|coin master|gacha|lootbox|loot box)\b/i.test(
        haystack(a),
      ),
    reason:
      "Name or description matches slot-machine keywords (slots/casino/jackpot/etc).",
  },
  {
    id: "gacha_pattern",
    name: "Gacha summon mechanics",
    weight: 8,
    category: "slot",
    match: (a) =>
      GAMES(a) &&
      /\b(summon|pull|banner|rate up|character pull|wish)\b/i.test(haystack(a)),
    reason: "Description references gacha summon/pull mechanics.",
  },
  {
    id: "mystery_box",
    name: "Mystery-box / random-reward",
    weight: 7,
    category: "slot",
    match: (a) =>
      /\b(mystery box|surprise|random reward|chance to win|lucky)\b/i.test(
        haystack(a),
      ),
    reason: "Description uses mystery-box / random-reward framing.",
  },

  // ── Algorithmic feed ──
  {
    id: "short_video_feed",
    name: "Short-video feed",
    weight: 7,
    category: "feed",
    match: bundleIdIn([
      "com.zhiliaoapp.musically", // TikTok
      "com.burbn.instagram", // Instagram (Reels)
      "com.google.ios.youtube", // YouTube (Shorts)
      "com.toyopagroup.picaboo", // Snapchat (Spotlight)
      "com.atebits.Tweetie2", // X (For You)
      "com.facebook.Facebook", // Facebook
      "com.burbn.barcelona", // Threads
      "xyz.blueskyweb.app", // Bluesky
      "com.bytedance.flipchat", // Lemon8
    ]),
    reason: "Algorithmic short-video feed, engineered for retention.",
  },
  {
    id: "infinite_scroll_social",
    name: "Infinite-scroll social",
    weight: 6,
    category: "feed",
    match: (a) => SOCIAL(a) && (a.userRatingCount ?? 0) > 100_000,
    reason:
      "Large-scale social networking app — infinite scroll optimized for engagement.",
  },
  {
    id: "news_doomscroll",
    name: "Personalized news feed",
    weight: 5,
    category: "feed",
    match: (a) =>
      a.primaryGenreName === "News" &&
      /\b(personalized|for you|trending|breaking)\b/i.test(haystack(a)),
    reason: "News app with personalized / trending / 'for you' feed.",
  },

  // ── Streak / loss-aversion ──
  {
    id: "streak_mechanic",
    name: "Streak / daily-login pressure",
    weight: 5,
    category: "streak",
    match: (a) =>
      /\b(streak|daily login|don'?t break|keep your|consecutive days)\b/i.test(
        haystack(a),
      ),
    reason: "Uses streaks or daily-login pressure to punish absence.",
  },
  {
    id: "energy_system",
    name: "Energy / stamina timers",
    weight: 5,
    category: "streak",
    match: (a) =>
      /\b(energy|stamina|hearts?|lives)\s+(refill|recharge|regenerate)/i.test(
        haystack(a),
      ),
    reason: "Energy/stamina/lives system that gates play on a timer.",
  },

  // ── Premium currency obfuscation ──
  {
    id: "dual_currency",
    name: "Dual currency + IAP",
    weight: 4,
    category: "currency",
    match: (a) =>
      /\b(gems|coins|crystals|diamonds|tokens|gold)\b/i.test(haystack(a)) &&
      hasIAP(a),
    reason: "Premium currency (gems/coins/crystals) paired with IAP.",
  },
  {
    id: "aggressive_iap",
    name: "Free game with heavy IAP",
    weight: 3,
    category: "currency",
    match: (a) =>
      a.formattedPrice === "Free" &&
      GAMES(a) &&
      (a.userRatingCount ?? 0) > 10_000,
    reason: "Free-to-play game at scale — revenue comes from IAP.",
  },

  // ── Notification weaponization ──
  {
    id: "comeback_notifs",
    name: "Comeback notifications",
    weight: 4,
    category: "notif",
    match: (a) =>
      /\b(notification|reminder|don'?t miss|come back)\b/i.test(haystack(a)) &&
      (GAMES(a) ||
        SOCIAL(a) ||
        a.primaryGenreName === "Shopping"),
    reason: "Weaponized notifications designed to pull you back.",
  },

  // ── Time-distortion design ──
  {
    id: "live_event_fomo",
    name: "Live-event FOMO",
    weight: 5,
    category: "time",
    match: (a) =>
      /\b(limited time|event ends|exclusive|24 hours only|flash sale)\b/i.test(
        haystack(a),
      ),
    reason:
      "Limited-time / flash-sale / event-ends framing to induce urgency.",
  },
];
