import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { ACCENT } from "../WireheadingDemo";

export const UploadScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // file flies from top-right into the drop zone
  const flyIn = interpolate(frame, [0, 40], [0, 1], { extrapolateRight: "clamp" });
  const fileX = interpolate(flyIn, [0, 1], [500, 0]);
  const fileY = interpolate(flyIn, [0, 1], [-250, 0]);
  const fileRot = interpolate(flyIn, [0, 1], [18, 0]);

  // drop zone highlights on hover
  const dropIntensity = interpolate(frame, [30, 45, 60], [0, 1, 0.3], {
    extrapolateRight: "clamp",
  });

  // scale pulse on drop
  const dropPulse = spring({
    frame: frame - 45,
    fps,
    config: { damping: 10, stiffness: 150 },
    durationInFrames: 20,
  });
  const pulseScale = interpolate(dropPulse, [0, 1], [1, 1.04]);

  // file disappears after upload
  const fileOpacity = interpolate(frame, [50, 70], [1, 0], {
    extrapolateRight: "clamp",
  });

  // progress bar after drop
  const progress = interpolate(frame, [55, 115], [0, 100], {
    extrapolateRight: "clamp",
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
          step 02 — upload
        </div>
        <h2
          style={{
            fontSize: 36,
            color: "#fff",
            margin: 0,
            marginBottom: 28,
          }}
        >
          Drop the recording.
        </h2>

        {/* drop zone */}
        <div
          style={{
            position: "relative",
            height: 260,
            borderRadius: 14,
            border: `2px dashed ${
              dropIntensity > 0.3 ? ACCENT : "#333"
            }`,
            background:
              dropIntensity > 0.3
                ? `rgba(124,255,178,${dropIntensity * 0.08})`
                : "#0a0a0a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${pulseScale})`,
            transition: "background 0.2s",
          }}
        >
          <div
            style={{
              textAlign: "center",
              color: "#777",
              fontSize: 14,
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 10, color: "#444" }}>
              ⇅
            </div>
            <div>drop .mov / .mp4 / .webm here</div>
            <div style={{ fontSize: 11, marginTop: 6, color: "#555" }}>
              max 200 MB · max 2 min · processed in memory
            </div>
          </div>

          {/* flying file */}
          <div
            style={{
              position: "absolute",
              width: 120,
              height: 80,
              borderRadius: 8,
              background: "#1a1a1a",
              border: "1px solid #2a2a2a",
              transform: `translate(${fileX}px, ${fileY}px) rotate(${fileRot}deg)`,
              opacity: fileOpacity,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#aaa",
              fontSize: 10,
              boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ fontSize: 22, color: ACCENT }}>▶</div>
            <div style={{ marginTop: 6 }}>home-scroll.mov</div>
            <div style={{ color: "#555", marginTop: 2 }}>
              48.2 MB
            </div>
          </div>
        </div>

        {/* progress bar */}
        <div
          style={{
            marginTop: 20,
            height: 4,
            background: "#151515",
            borderRadius: 2,
            overflow: "hidden",
            opacity: progress > 0 ? 1 : 0,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: ACCENT,
            }}
          />
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: "#666",
            display: "flex",
            justifyContent: "space-between",
            opacity: progress > 0 ? 1 : 0,
          }}
        >
          <span>home-scroll.mov</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
