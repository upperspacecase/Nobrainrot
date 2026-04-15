import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { ACCENT } from "../WireheadingDemo";

type Tier = "DELETE" | "RECONSIDER" | "KEEP";

const RESULTS: {
  name: string;
  score: number;
  tier: Tier;
  rules: string[];
  one_liner: string;
}[] = [
  {
    name: "Coin Master",
    score: 24,
    tier: "DELETE",
    rules: ["casino_keywords", "gacha_pattern", "energy_system", "dual_currency"],
    one_liner: "A literal slot machine wrapped in a village-building skin.",
  },
  {
    name: "Slotomania",
    score: 22,
    tier: "DELETE",
    rules: ["gambling_advisory", "casino_keywords", "dual_currency"],
    one_liner: "Gambling advisory. Actual slot machine.",
  },
  {
    name: "TikTok",
    score: 14,
    tier: "DELETE",
    rules: ["short_video_feed", "autoplay_video", "infinite_scroll_social"],
    one_liner: "Algorithmic short-video feed. Engineered for retention.",
  },
  {
    name: "Candy Crush",
    score: 13,
    tier: "DELETE",
    rules: ["energy_system", "dual_currency", "live_event_fomo"],
    one_liner: "Energy timers + premium currency + limited-time events.",
  },
  {
    name: "Instagram",
    score: 11,
    tier: "RECONSIDER",
    rules: ["infinite_scroll_social", "short_video_feed", "comeback_notifs"],
    one_liner: "Reels feed + engagement-weaponized notifications.",
  },
  {
    name: "Duolingo",
    score: 7,
    tier: "RECONSIDER",
    rules: ["streak_mechanic", "comeback_notifs"],
    one_liner: "Streak pressure + comeback notifications — useful but loud.",
  },
  {
    name: "Messages",
    score: 0,
    tier: "KEEP",
    rules: [],
    one_liner: "No slot mechanics detected.",
  },
  {
    name: "Notes",
    score: 0,
    tier: "KEEP",
    rules: [],
    one_liner: "Utility. Clean.",
  },
];

const TIER_COLORS: Record<Tier, string> = {
  DELETE: "#ff4d4d",
  RECONSIDER: "#ffb84d",
  KEEP: ACCENT,
};

export const ResultsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerSpring = spring({ frame, fps, config: { damping: 200 } });
  const headerOpacity = interpolate(headerSpring, [0, 1], [0, 1]);
  const headerY = interpolate(headerSpring, [0, 1], [20, 0]);

  return (
    <AbsoluteFill style={{ padding: "40px 80px", overflow: "hidden" }}>
      {/* header */}
      <div
        style={{
          opacity: headerOpacity,
          transform: `translateY(${headerY}px)`,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.25em",
            color: "#666",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          step 04 — results
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
          <h2
            style={{
              fontSize: 32,
              color: "#fff",
              margin: 0,
            }}
          >
            4 of 8 apps flagged for deletion.
          </h2>
          <span
            style={{
              fontSize: 13,
              color: "#666",
            }}
          >
            total wireheading score: <span style={{ color: "#fff" }}>91</span>
          </span>
        </div>
      </div>

      {/* two column grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          flex: 1,
        }}
      >
        <div>
          {RESULTS.slice(0, 4).map((r, i) => (
            <ResultRow key={i} result={r} index={i} />
          ))}
        </div>
        <div>
          {RESULTS.slice(4).map((r, i) => (
            <ResultRow key={i} result={r} index={i + 4} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ResultRow: React.FC<{
  result: (typeof RESULTS)[number];
  index: number;
}> = ({ result, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delay = 15 + index * 12;
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });
  const opacity = interpolate(s, [0, 1], [0, 1]);
  const ty = interpolate(s, [0, 1], [10, 0]);

  const color = TIER_COLORS[result.tier];

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${ty}px)`,
        border: "1px solid #141414",
        background: "#0a0a0a",
        borderRadius: 8,
        padding: "12px 14px",
        marginBottom: 10,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* tier badge */}
      <div
        style={{
          width: 88,
          textAlign: "center",
          fontSize: 10,
          letterSpacing: "0.15em",
          padding: "4px 0",
          borderRadius: 4,
          border: `1px solid ${color}`,
          color,
          background: `${color}11`,
        }}
      >
        {result.tier}
      </div>

      {/* name + rules */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          {result.name}
        </div>
        <div
          style={{
            color: "#666",
            fontSize: 11,
            marginTop: 3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {result.rules.length === 0 ? "—" : result.rules.join("  ·  ")}
        </div>
      </div>

      {/* score */}
      <div
        style={{
          fontSize: 22,
          color,
          fontWeight: 700,
          minWidth: 40,
          textAlign: "right",
        }}
      >
        {result.score}
      </div>
    </div>
  );
};
