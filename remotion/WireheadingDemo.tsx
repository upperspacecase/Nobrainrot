import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PhoneScrollScene } from "./scenes/PhoneScrollScene";
import { UploadScene } from "./scenes/UploadScene";
import { ProcessingScene } from "./scenes/ProcessingScene";
import { ResultsScene } from "./scenes/ResultsScene";

// 30 fps timeline
export const SCENE_PHONE = 150; // 0–5s
export const SCENE_UPLOAD = 120; // 5–9s
export const SCENE_PROCESSING = 240; // 9–17s
export const SCENE_RESULTS = 270; // 17–26s
export const DEMO_DURATION =
  SCENE_PHONE + SCENE_UPLOAD + SCENE_PROCESSING + SCENE_RESULTS;

const ACCENT = "#7CFFB2";

export const WireheadingDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // subtle cursor blink on the chrome
  const blink = Math.floor(frame / 15) % 2 === 0 ? 1 : 0.2;

  return (
    <AbsoluteFill
      style={{
        background: "#000",
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        color: "#e5e5e5",
      }}
    >
      {/* top chrome */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 44,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 20px",
          borderBottom: "1px solid #1a1a1a",
          fontSize: 12,
          color: "#666",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <Dot color="#ff5f57" />
          <Dot color="#febc2e" />
          <Dot color="#28c840" />
        </div>
        <div style={{ marginLeft: 12 }}>
          wireheading.life-time.co
          <span style={{ opacity: blink, color: ACCENT }}>▌</span>
        </div>
        <div style={{ marginLeft: "auto", color: "#444" }}>
          {Math.floor(frame / fps)
            .toString()
            .padStart(2, "0")}
          :
          {(frame % fps).toString().padStart(2, "0")}
        </div>
      </div>

      <AbsoluteFill style={{ paddingTop: 44 }}>
        <Sequence from={0} durationInFrames={SCENE_PHONE}>
          <PhoneScrollScene />
        </Sequence>
        <Sequence from={SCENE_PHONE} durationInFrames={SCENE_UPLOAD}>
          <UploadScene />
        </Sequence>
        <Sequence
          from={SCENE_PHONE + SCENE_UPLOAD}
          durationInFrames={SCENE_PROCESSING}
        >
          <ProcessingScene />
        </Sequence>
        <Sequence
          from={SCENE_PHONE + SCENE_UPLOAD + SCENE_PROCESSING}
          durationInFrames={SCENE_RESULTS}
        >
          <ResultsScene />
        </Sequence>
      </AbsoluteFill>

      {/* scene label bottom-right */}
      <SceneLabel />
    </AbsoluteFill>
  );
};

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <div
    style={{
      width: 10,
      height: 10,
      borderRadius: 5,
      background: color,
    }}
  />
);

const SceneLabel: React.FC = () => {
  const frame = useCurrentFrame();
  let label = "";
  if (frame < SCENE_PHONE) label = "01 — record";
  else if (frame < SCENE_PHONE + SCENE_UPLOAD) label = "02 — upload";
  else if (frame < SCENE_PHONE + SCENE_UPLOAD + SCENE_PROCESSING)
    label = "03 — audit";
  else label = "04 — results";

  return (
    <div
      style={{
        position: "absolute",
        bottom: 18,
        right: 24,
        fontSize: 11,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color: "#555",
        zIndex: 10,
      }}
    >
      {label}
    </div>
  );
};

export { ACCENT };
