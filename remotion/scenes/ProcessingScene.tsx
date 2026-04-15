import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { ACCENT } from "../constants";

const STEPS = [
  { label: "Extracting frames", detail: "1 fps · pHash dedupe", duration: 60 },
  { label: "Reading app names", detail: "tesseract.js · OCR", duration: 60 },
  { label: "Looking up metadata", detail: "iTunes Search API", duration: 60 },
  { label: "Scoring", detail: "18 rules · rule-based", duration: 60 },
];

export const ProcessingScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Determine current step and progress
  let elapsed = 0;
  const stepStates = STEPS.map((step) => {
    const start = elapsed;
    const end = elapsed + step.duration;
    elapsed = end;
    let status: "pending" | "active" | "done" = "pending";
    let pct = 0;
    if (frame >= end) {
      status = "done";
      pct = 100;
    } else if (frame >= start) {
      status = "active";
      pct = interpolate(frame, [start, end], [0, 100], {
        extrapolateRight: "clamp",
      });
    }
    return { ...step, status, pct };
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: 720, maxWidth: "85%" }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.25em",
            color: "#666",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          step 03 — auditing
        </div>
        <h2
          style={{
            fontSize: 36,
            color: "#fff",
            margin: 0,
            marginBottom: 32,
          }}
        >
          Reading your apps.
        </h2>

        <div
          style={{
            border: "1px solid #1a1a1a",
            borderRadius: 10,
            background: "#0a0a0a",
            padding: 20,
          }}
        >
          {stepStates.map((step, i) => (
            <StepRow key={i} step={step} index={i} />
          ))}
        </div>

        {/* live ticker of OCR'd apps */}
        <Ticker frame={frame} />
      </div>
    </AbsoluteFill>
  );
};

const StepRow: React.FC<{
  step: {
    label: string;
    detail: string;
    status: "pending" | "active" | "done";
    pct: number;
  };
  index: number;
}> = ({ step, index }) => {
  const color =
    step.status === "done"
      ? ACCENT
      : step.status === "active"
        ? "#fff"
        : "#444";
  return (
    <div
      style={{
        padding: "14px 0",
        borderBottom: index < 3 ? "1px solid #141414" : "none",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ width: 18, color, fontSize: 14 }}>
        {step.status === "done" ? "✓" : step.status === "active" ? "›" : "·"}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            color,
            fontSize: 15,
            marginBottom: 6,
          }}
        >
          {step.label}
          <span style={{ color: "#555", marginLeft: 10, fontSize: 11 }}>
            {step.detail}
          </span>
        </div>
        <div
          style={{
            height: 2,
            background: "#1a1a1a",
            borderRadius: 1,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${step.pct}%`,
              background: step.status === "done" ? ACCENT : "#fff",
              opacity: step.status === "pending" ? 0 : 1,
            }}
          />
        </div>
      </div>
    </div>
  );
};

const OCR_STREAM = [
  "Coin Master",
  "TikTok",
  "Instagram",
  "Notes",
  "Candy Crush",
  "Royal Match",
  "Messages",
  "Reels",
  "YouTube",
  "Snapchat",
  "Maps",
  "Gacha Life",
  "Threads",
  "Slotomania",
  "Duolingo",
  "Calculator",
  "Shein",
  "Files",
];

const Ticker: React.FC<{ frame: number }> = ({ frame }) => {
  // reveal up to N apps depending on frame
  const n = Math.min(
    OCR_STREAM.length,
    Math.floor(interpolate(frame, [70, 230], [0, OCR_STREAM.length], {
      extrapolateRight: "clamp",
      extrapolateLeft: "clamp",
    })),
  );
  return (
    <div
      style={{
        marginTop: 18,
        padding: "10px 14px",
        background: "#050505",
        border: "1px solid #111",
        borderRadius: 6,
        fontSize: 11,
        color: "#666",
        minHeight: 32,
        display: "flex",
        flexWrap: "wrap",
        gap: "6px 10px",
      }}
    >
      <span style={{ color: "#333", marginRight: 4 }}>$</span>
      <span style={{ color: "#444" }}>detected</span>
      {OCR_STREAM.slice(0, n).map((app, i) => (
        <span
          key={i}
          style={{
            color: i === n - 1 ? "#fff" : "#888",
          }}
        >
          {app}
          {i < n - 1 ? "," : ""}
        </span>
      ))}
      <span style={{ color: ACCENT, marginLeft: 4 }}>
        {frame % 30 < 15 ? "▌" : " "}
      </span>
    </div>
  );
};
