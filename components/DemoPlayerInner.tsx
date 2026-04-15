"use client";

import { Player } from "@remotion/player";
import {
  WireheadingDemo,
  DEMO_DURATION,
} from "@/remotion/WireheadingDemo";

export default function DemoPlayerInner() {
  return (
    <Player
      component={WireheadingDemo}
      durationInFrames={DEMO_DURATION}
      fps={30}
      compositionWidth={1280}
      compositionHeight={720}
      style={{ width: "100%", aspectRatio: "16 / 9" }}
      controls
      autoPlay
      loop
    />
  );
}
