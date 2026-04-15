"use client";

import dynamic from "next/dynamic";

// Remotion's Player has module-init issues when bundled for the server, so we
// load it lazily on the client only.
const LazyDemoPlayer = dynamic(() => import("./DemoPlayerInner"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        aspectRatio: "16 / 9",
        background: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#555",
        fontSize: 12,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
      }}
    >
      loading demo…
    </div>
  ),
});

export default function DemoPlayer() {
  return <LazyDemoPlayer />;
}
