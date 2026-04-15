import { Composition } from "remotion";
import { WireheadingDemo, DEMO_DURATION } from "./WireheadingDemo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="WireheadingDemo"
        component={WireheadingDemo}
        durationInFrames={DEMO_DURATION}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
