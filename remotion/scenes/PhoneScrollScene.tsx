import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";

const APPS = [
  { name: "Coin Master", color: "#ffb200", tier: "bad" },
  { name: "TikTok", color: "#000", text: "#fff", tier: "bad" },
  { name: "Instagram", color: "#e1306c", tier: "bad" },
  { name: "Candy Crush", color: "#ff5d8f", tier: "bad" },
  { name: "Royal Match", color: "#7a3ff0", tier: "bad" },
  { name: "Notes", color: "#f7d046", text: "#000", tier: "ok" },
  { name: "Messages", color: "#00d64f", tier: "ok" },
  { name: "Safari", color: "#1e90ff", tier: "ok" },
  { name: "Reels", color: "#d82b6a", tier: "bad" },
  { name: "YouTube", color: "#ff0000", tier: "bad" },
  { name: "Snapchat", color: "#fffc00", text: "#000", tier: "bad" },
  { name: "Maps", color: "#4a88ff", tier: "ok" },
  { name: "Calculator", color: "#ff9500", tier: "ok" },
  { name: "Gacha Life", color: "#ffc0cb", text: "#000", tier: "bad" },
  { name: "Duolingo", color: "#58cc02", tier: "mid" },
  { name: "Calendar", color: "#fff", text: "#000", tier: "ok" },
  { name: "Slotomania", color: "#ff2e63", tier: "bad" },
  { name: "Threads", color: "#111", text: "#fff", tier: "bad" },
  { name: "Files", color: "#2297ff", tier: "ok" },
  { name: "Shein", color: "#000", text: "#fff", tier: "bad" },
];

export const PhoneScrollScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 200 } });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  // pan the app grid upward to simulate scrolling
  const scrollY = interpolate(frame, [0, 150], [0, -460], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        padding: "40px 80px",
        gap: 80,
      }}
    >
      {/* left: phone */}
      <div
        style={{
          width: 300,
          height: 600,
          borderRadius: 48,
          background: "#111",
          border: "3px solid #222",
          boxShadow: "0 30px 80px rgba(124,255,178,0.06)",
          overflow: "hidden",
          position: "relative",
          flexShrink: 0,
        }}
      >
        {/* notch */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            width: 110,
            height: 26,
            borderRadius: 13,
            background: "#000",
            zIndex: 5,
          }}
        />
        {/* app grid that scrolls */}
        <div
          style={{
            position: "absolute",
            top: 60,
            left: 20,
            right: 20,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            transform: `translateY(${scrollY}px)`,
          }}
        >
          {APPS.map((app, i) => (
            <AppIcon key={i} app={app} />
          ))}
        </div>
        {/* subtle top fade */}
        <div
          style={{
            position: "absolute",
            top: 44,
            left: 0,
            right: 0,
            height: 20,
            background:
              "linear-gradient(to bottom, #111 0%, rgba(17,17,17,0) 100%)",
            zIndex: 4,
          }}
        />
      </div>

      {/* right: narration */}
      <div style={{ flex: 1, opacity: titleOpacity }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.25em",
            color: "#666",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          step 01
        </div>
        <h1
          style={{
            fontSize: 54,
            fontWeight: 600,
            lineHeight: 1.05,
            color: "#fff",
            margin: 0,
          }}
        >
          Record your
          <br />
          home screens.
        </h1>
        <p
          style={{
            marginTop: 24,
            fontSize: 18,
            lineHeight: 1.5,
            color: "#888",
            maxWidth: 420,
          }}
        >
          A slow scroll through every app you keep. Two minutes max, no signup.
        </p>
        <div
          style={{
            marginTop: 40,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 6,
            border: "1px solid #222",
            fontSize: 13,
            color: "#aaa",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: "#ff4444",
              boxShadow: "0 0 8px #ff4444",
              display: "inline-block",
            }}
          />
          REC · screen recording
        </div>
      </div>
    </AbsoluteFill>
  );
};

const AppIcon: React.FC<{
  app: { name: string; color: string; text?: string };
}> = ({ app }) => {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: app.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          fontWeight: 700,
          color: app.text || "#fff",
          margin: "0 auto",
        }}
      >
        {app.name.slice(0, 1)}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 9,
          color: "#ccc",
          fontFamily: "system-ui, sans-serif",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {app.name}
      </div>
    </div>
  );
};
